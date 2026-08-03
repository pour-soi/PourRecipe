import {expect,test} from "@playwright/test";

test("category and tag page supports grouped management without deleting recipes",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/#/categories");
  await expect(page.locator(".page-context")).toHaveText("分类与标签");
  await expect(page.locator(".bottom-nav a")).toHaveText(["食谱","分类","厨房工具","设置"]);
  await expect(page.getByText("还没有分类",{exact:true})).toBeVisible();
  await expect(page.getByText("创建分类来整理你的食谱",{exact:true})).toBeVisible();

  page.once("dialog",dialog=>dialog.accept("早餐"));
  await page.getByRole("button",{name:/新建分类/}).first().click();
  page.once("dialog",dialog=>dialog.accept("晚餐"));
  await page.getByRole("button",{name:/新建分类/}).click();
  await expect(page.locator(".taxonomy-row")).toHaveCount(2);

  await page.getByLabel("早餐更多操作").click();
  page.once("dialog",dialog=>dialog.accept("早午餐"));
  await page.getByRole("button",{name:"改名",exact:true}).click();
  await expect(page.getByText("早午餐",{exact:true})).toBeVisible();

  await page.getByRole("link",{name:"食谱",exact:true}).click();
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await page.getByRole("button",{name:/手动输入/}).click();
  await page.getByLabel("名称",{exact:true}).fill("分类关联食谱");
  await page.getByText("更多设置",{exact:true}).click();
  await page.getByLabel("早午餐",{exact:true}).check();
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await page.getByRole("button",{name:"保存",exact:true}).click();
  await page.locator(".detail-top button").first().click();
  await page.getByRole("link",{name:"分类",exact:true}).click();
  await expect(page.locator(".taxonomy-row",{hasText:"早午餐"})).toContainText("1 份食谱");

  await page.getByLabel("晚餐更多操作").click();
  await page.getByRole("button",{name:"上移",exact:true}).click();
  await expect(page.locator(".taxonomy-name b").first()).toHaveText("晚餐");

  await page.getByLabel("早午餐更多操作").click();
  const mergeDialogs:(string|boolean)[]=["晚餐",true],mergeHandler=(dialog:import("@playwright/test").Dialog)=>{const value=mergeDialogs.shift();return typeof value==="string"?dialog.accept(value):dialog.accept()};
  page.on("dialog",mergeHandler);
  await page.getByRole("button",{name:"合并",exact:true}).click();
  page.off("dialog",mergeHandler);
  await expect(page.locator(".taxonomy-row")).toHaveCount(1);
  await expect(page.locator(".taxonomy-row")).toContainText("1 份食谱");

  await page.getByLabel("晚餐更多操作").click();
  page.once("dialog",async dialog=>{expect(dialog.message()).toContain("关联 1 份食谱");expect(dialog.message()).toContain("绝不会删除食谱");await dialog.accept()});
  await page.getByRole("button",{name:"删除",exact:true}).click();
  await expect(page.getByText("还没有分类",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"食谱",exact:true}).click();
  await expect(page.getByRole("heading",{name:"分类关联食谱",level:3})).toBeVisible();

  await page.getByRole("link",{name:"分类",exact:true}).click();
  await page.getByRole("tab",{name:"标签",exact:true}).click();
  await expect(page.getByText("还没有标签",{exact:true})).toBeVisible();
  await expect(page.getByText("使用标签记录口味、工具或场景",{exact:true})).toBeVisible();
  page.once("dialog",dialog=>dialog.accept("空气炸锅"));
  await page.getByRole("button",{name:/新建标签/}).first().click();
  await expect(page.locator(".taxonomy-row")).toContainText("空气炸锅");
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.context().setOffline(true);
  await page.reload();
  await page.getByRole("tab",{name:"标签",exact:true}).click();
  await expect(page.locator(".taxonomy-row")).toContainText("空气炸锅");
  await page.context().setOffline(false);
});
