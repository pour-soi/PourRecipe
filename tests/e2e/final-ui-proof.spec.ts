import {expect,test} from "@playwright/test";

for(const width of [390,1440] as const){
  test(`captures final item 7-9 surfaces at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:width===390?844:1000});

    await page.goto("/");
    await expect(page.getByRole("heading",{name:"PourRecipe",exact:true})).toBeVisible();
    await page.screenshot({path:`test-results/final-ui-proof-7-9/home-${width}.png`});

    await page.getByRole("link",{name:"分类",exact:true}).click();
    await expect(page.getByRole("tablist",{name:"分类与标签"})).toBeVisible();
    await page.screenshot({path:`test-results/final-ui-proof-7-9/category-${width}.png`});
    await page.getByRole("tab",{name:"标签",exact:true}).click();
    await page.screenshot({path:`test-results/final-ui-proof-7-9/tag-${width}.png`});

    await page.getByRole("link",{name:"设置",exact:true}).click();
    await expect(page.getByRole("heading",{name:"账号与同步",exact:true})).toBeVisible();
    await page.screenshot({path:`test-results/final-ui-proof-7-9/settings-${width}.png`,fullPage:true});

    await page.getByRole("link",{name:"厨房工具",exact:true}).click();
    await expect(page.getByRole("heading",{name:"温度换算",exact:true})).toBeVisible();
    await page.screenshot({path:`test-results/final-ui-proof-7-9/kitchen-tools-${width}.png`});

    await page.getByRole("link",{name:"食谱",exact:true}).click();
    await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
    await expect(page.getByRole("region",{name:"选择添加方式"})).toBeVisible();
    await page.screenshot({path:`test-results/final-ui-proof-7-9/new-recipe-${width}.png`});

    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  });
}
