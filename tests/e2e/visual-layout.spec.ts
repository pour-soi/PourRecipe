import {expect,test} from "@playwright/test";
import path from "node:path";

const imagePath=path.resolve("public/pwa-192.png");

test("branding metadata and approved light tokens stay consistent",async({page})=>{
  await page.goto("/");
  await expect(page).toHaveTitle("PourRecipe");
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute("content","PourRecipe");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content","PourRecipe");
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content","#176D5E");
  const manifest=await page.evaluate(async()=>await (await fetch("/manifest.webmanifest")).json());
  expect({name:manifest.name,shortName:manifest.short_name,theme:manifest.theme_color,background:manifest.background_color}).toEqual({name:"PourRecipe",shortName:"PourRecipe",theme:"#176D5E",background:"#F1F5F2"});
  expect(manifest.icons.map((icon:{src:string})=>icon.src)).toEqual(["/pwa-192.png","/pwa-512.png","/pwa-maskable-512.png"]);
  expect(await page.evaluate(()=>{const style=getComputedStyle(document.documentElement);return["--app-bg","--surface","--surface-strong","--accent","--danger"].map(name=>style.getPropertyValue(name).trim().toLowerCase())})).toEqual(["#f1f5f2","#fafbfa","#fff","#176d5e","#b85c5c"]);
});

for(const width of [320,375,390,430,1440]){
  test(`home layout stays within ${width}px`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height:width===1440?1000:900}});
    const page=await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("heading",{name:"PourRecipe",level:1})).toBeVisible();
    await expect(page.getByText("我的食谱",{exact:true})).toHaveCount(0);
    await expect(page.getByText("快速新增",{exact:true})).toHaveCount(0);
    await expect(page.getByPlaceholder("搜索食谱、食材、标签……")).toBeVisible();
    await expect(page.locator(".bottom-nav a")).toHaveCount(4);
    await expect(page.locator(".bottom-nav a")).toHaveText(["食谱","分类","厨房工具","设置"]);
    expect(await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}))).toEqual({client:width,scroll:width});
    expect(await page.locator(".page-header").evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
    expect(await page.locator(".bottom-nav").evaluate(element=>element.getBoundingClientRect().top<document.documentElement.clientHeight)).toBe(true);
    await page.screenshot({path:`test-results/visual/home-${width}.png`,fullPage:true});
    await context.close();
  });
}

test("home sorting menu exposes every supported order",async({page})=>{
  await page.goto("/");
  await page.getByLabel("食谱排序").click();
  await expect(page.getByRole("menuitem",{name:"最近更新"})).toBeVisible();
  await expect(page.getByRole("menuitem",{name:"最近添加"})).toBeVisible();
  await expect(page.getByRole("menuitem",{name:"最近制作"})).toBeVisible();
  await expect(page.getByRole("menuitem",{name:"名称"})).toBeVisible();
});

test("new recipe flow is task driven and resumes a manual draft",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await expect(page.getByRole("button",{name:/上传截图/})).toBeVisible();
  await expect(page.getByRole("button",{name:/粘贴文字/})).toBeVisible();
  await expect(page.getByRole("button",{name:/手动输入/})).toBeVisible();
  await expect(page.getByRole("button",{name:/拍照/})).toBeVisible();
  await expect(page.getByLabel("描述")).toHaveCount(0);
  await page.getByRole("button",{name:/手动输入/}).click();
  await expect(page.getByLabel("食材 1",{exact:true})).toBeVisible();
  await expect(page.getByLabel("步骤 1",{exact:true})).toBeVisible();
  await expect(page.getByText("更多设置",{exact:true})).toBeVisible();
  await page.getByLabel("食材 1",{exact:true}).fill("面粉 500 g");
  await page.getByLabel("食材 1",{exact:true}).press("Enter");
  await expect(page.getByLabel("食材 2",{exact:true})).toBeFocused();
  await page.getByLabel("名称",{exact:true}).fill("可恢复草稿");
  await page.setViewportSize({width:390,height:500});
  await expect(page.getByRole("button",{name:"保存",exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("名称",{exact:true})).toHaveValue("可恢复草稿");
  await expect(page.getByLabel("食材 1",{exact:true})).toHaveValue("面粉 500 g");
  await page.getByRole("button",{name:"取消",exact:true}).click();
  await expect(page.getByRole("heading",{name:"PourRecipe",level:1})).toBeVisible();
});

test("paste and photo methods expose only their capture task first",async({page})=>{
  await page.goto("/");
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await page.getByRole("button",{name:/粘贴文字/}).click();
  await expect(page.getByLabel("粘贴食谱文字")).toBeVisible();
  await expect(page.getByLabel("名称",{exact:true})).toHaveCount(0);
  await page.getByLabel("粘贴食谱文字").fill("番茄汤\n番茄 2 个\n1. 切好后煮 10 分钟");
  await page.getByRole("button",{name:"继续",exact:true}).click();
  await expect(page.getByText("结构化解析预览",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"取消",exact:true}).click();
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await page.getByRole("button",{name:/拍照/}).click();
  await expect(page.getByLabel("拍摄食谱封面 - 拍照")).toBeAttached();
  await expect(page.getByLabel("名称",{exact:true})).toHaveCount(0);
});

test("full editor manages images through one unified entry",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await page.getByRole("button",{name:/手动输入/}).click();
  await page.getByLabel("名称",{exact:true}).fill("统一图片测试");
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await expect(page.getByRole("heading",{name:"编辑食谱",exact:true})).toBeVisible();
  await expect(page.getByLabel("封面图片 - 从相册选择")).toHaveCount(0);
  await page.getByRole("button",{name:"添加图片",exact:true}).click();
  await expect(page.getByRole("group",{name:"选择图片类型"}).getByRole("button")).toHaveCount(5);
  await expect(page.getByRole("button",{name:/制作图片/})).toBeDisabled();
  await page.getByRole("button",{name:"封面",exact:true}).click();
  await page.getByLabel("图片 - 从照片选择 - 封面").setInputFiles([imagePath,imagePath]);
  await expect(page.locator(".image-tile")).toHaveCount(2);
  await expect(page.locator(".image-tile").first()).toContainText("当前封面");
  await page.locator(".image-tile").first().getByRole("button",{name:"操作"}).click();
  page.once("dialog",dialog=>dialog.accept("测试备注"));
  await page.locator(".image-tile").first().getByRole("button",{name:"添加备注"}).click();
  await expect(page.locator(".image-tile").first()).toContainText("测试备注");
  await page.locator(".image-tile").nth(1).getByRole("button",{name:"操作"}).click();
  await page.getByLabel("更改图片类型 2").selectOption("ingredient");
  await expect(page.locator(".image-tile").nth(1)).toContainText("食材图片");
  await page.locator(".image-tile").nth(1).getByRole("button",{name:"操作"}).click();
  await page.locator(".image-tile").nth(1).getByRole("button",{name:"设为封面"}).click();
  await expect(page.locator(".image-tile").nth(1)).toContainText("当前封面");
  await page.locator(".image-tile").first().getByRole("button",{name:"操作"}).click();
  await page.getByLabel("替换图片 1").setInputFiles(imagePath);
  page.once("dialog",dialog=>dialog.accept());
  await page.locator(".image-tile").first().getByRole("button",{name:"删除"}).click();
  await expect(page.locator(".image-tile")).toHaveCount(1);
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await expect(page.getByRole("heading",{name:"统一图片测试",level:1})).toBeVisible();
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading",{name:"统一图片测试",level:3})).toBeVisible();
  await expect(page.locator(".card .cover img")).toBeVisible();
  await page.context().setOffline(false);
});

test("captures key 390px surfaces",async({page})=>{
  test.setTimeout(45_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await page.getByRole("button",{name:/手动输入/}).click();
  await page.screenshot({path:"test-results/visual/add-recipe-390.png",fullPage:true});
  await page.getByLabel("名称",{exact:true}).fill("番茄烤鸡");
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await expect(page.getByRole("heading",{name:"编辑食谱",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await page.screenshot({path:"test-results/visual/recipe-detail-390.png",fullPage:true});
  await page.locator(".detail-top button").first().click({timeout:5_000});
  await page.getByRole("link",{name:"分类",exact:true}).click({timeout:5_000});
  await page.screenshot({path:"test-results/visual/categories-390.png",fullPage:true});
  await page.locator(".bottom-nav a", {hasText:"设置"}).click({timeout:5_000});
  await page.screenshot({path:"test-results/visual/settings-390.png",fullPage:true});
  await page.getByRole("button",{name:/回收站/}).click({timeout:5_000});
  await page.screenshot({path:"test-results/visual/trash-390.png",fullPage:true});
});

test("captures OCR review and kitchen tools at 390px",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await page.getByRole("button",{name:/粘贴文字/}).click();
  await page.getByLabel("粘贴食谱文字").fill("番茄汤\n番茄 2 个\n1. 切好后煮 10 分钟");
  await page.getByRole("button",{name:"继续",exact:true}).click();
  await expect(page.getByText("结构化解析预览",{exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/visual/ocr-review-390.png",fullPage:true});
  await page.getByRole("button",{name:"取消",exact:true}).click();
  await page.getByRole("link",{name:"厨房工具",exact:true}).click();
  await expect(page.locator(".kitchen-tools")).toBeVisible();
  await page.screenshot({path:"test-results/visual/kitchen-tools-390.png",fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});

for(const width of [390,1440]){
  test(`captures stage 1-3 flows at ${width}px`,async({browser})=>{
    const context=await browser.newContext({viewport:{width,height:width===1440?1000:844}}),page=await context.newPage();
    await page.goto("/");
    await page.screenshot({path:`test-results/visual/stage-1-home-${width}.png`,fullPage:true});
    await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
    await expect(page.getByRole("button",{name:/上传截图/})).toBeVisible();
    await page.screenshot({path:`test-results/visual/stage-2-new-recipe-${width}.png`,fullPage:true});
    await page.getByRole("button",{name:/上传截图/}).click();
    await page.getByLabel("食谱截图 - 选择照片或文件").setInputFiles([path.resolve("public/apple-touch-icon.png"),path.resolve("public/pwa-192.png"),path.resolve("public/pwa-512.png")]);
    await expect(page.locator(".screenshot-review li")).toHaveCount(3,{timeout:30_000});
    await expect(page.locator(".screenshot-review li").nth(0)).toHaveAttribute("aria-label",/apple-touch-icon\.png/);
    await expect(page.locator(".screenshot-review li").nth(1)).toHaveAttribute("aria-label",/pwa-192\.png/);
    await expect(page.locator(".screenshot-review li").nth(2)).toHaveAttribute("aria-label",/pwa-512\.png/);
    await page.screenshot({path:`test-results/visual/stage-3-multi-screenshot-${width}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    await context.close();
  });
}

for(const width of [390,1440]){
  test(`captures stage 4-6 flows at ${width}px`,async({browser})=>{
    test.setTimeout(90_000);
    const context=await browser.newContext({viewport:{width,height:width===1440?1000:844}}),page=await context.newPage();
    await page.goto("/");
    await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
    await page.getByRole("button",{name:/上传截图/}).click();
    await page.getByLabel("食谱截图 - 选择照片或文件").setInputFiles([path.resolve("public/apple-touch-icon.png"),path.resolve("public/pwa-192.png"),path.resolve("public/pwa-512.png")]);
    await expect(page.locator(".screenshot-review li")).toHaveCount(3,{timeout:30_000});
    await page.getByRole("button",{name:"继续",exact:true}).click();
    await expect(page.getByLabel("OCR 队列")).toContainText("共 3 张");
    await expect(page.getByText("智能整理整份食谱",{exact:true})).toBeVisible();
    await page.locator(".sheet").evaluate(element=>element.scrollTop=0);
    await page.screenshot({path:`test-results/visual/stage-4-ocr-ai-review-${width}.png`,fullPage:true});
    await page.getByRole("button",{name:"取消",exact:true}).click();

    await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
    await page.getByRole("button",{name:/手动输入/}).click();
    await page.getByLabel("名称",{exact:true}).fill("统一图片阶段截图");
    await page.getByRole("button",{name:"保存",exact:true}).click();
    await page.getByRole("button",{name:"添加图片",exact:true}).click();
    await page.getByRole("button",{name:"封面",exact:true}).click();
    await page.getByLabel("图片 - 从照片选择 - 封面").setInputFiles([path.resolve("public/pwa-192.png"),path.resolve("public/pwa-512.png")]);
    await expect(page.locator(".image-tile")).toHaveCount(2,{timeout:30_000});
    await page.screenshot({path:`test-results/visual/stage-5-image-management-${width}.png`,fullPage:true});
    await page.getByRole("button",{name:"取消",exact:true}).click();

    await page.getByRole("link",{name:"厨房工具",exact:true}).click();
    await expect(page.locator(".page-context")).toHaveText("厨房工具");
    await expect(page.getByText("356 °F",{exact:true})).toBeVisible();
    await page.screenshot({path:`test-results/visual/stage-6-kitchen-tools-${width}.png`,fullPage:true});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    await context.close();
  });
}
