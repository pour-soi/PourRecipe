import {expect,test} from "@playwright/test";

test("settings uses grouped rows and keeps tools separate",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("/#/settings");
  for(const title of ["账号与同步","本地数据","备份与恢复","OCR","AI","关于与隐私"])await expect(page.getByRole("heading",{name:title,exact:true})).toBeVisible();
  await expect(page.getByText("厨房工具",{exact:true})).toHaveCount(1);
  await expect(page.locator(".settings-clean")).not.toContainText("厨房工具");
  await page.getByRole("button",{name:/登录方式/}).click();
  await expect(page.getByRole("dialog",{name:"账号登录"})).toBeVisible();
  await expect(page.getByRole("tablist",{name:"登录方式"})).toBeVisible();
  await page.getByRole("button",{name:"完成"}).click();
  await page.getByRole("button",{name:/暂停同步/}).click();
  await expect(page.getByText("已暂停",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:/恢复同步/}).click();
  await expect(page.getByText("同步已恢复",{exact:true})).toBeVisible();
  const ai=page.getByLabel("AI 智能整理");
  await page.locator(".settings-switch").click();
  await expect(ai).toBeChecked();
  await page.getByRole("button",{name:/回收站/}).click();
  await expect(page.getByText("全选",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
