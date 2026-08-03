import {expect,test} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const sample=fs.readFileSync(path.resolve("tests/assets/ocr-sample.png"));

test("imports, numbers, reorders, and deletes from a 30-screenshot selection",async({page})=>{
  test.setTimeout(120_000);
  await page.setViewportSize({width:390,height:844});
  await page.goto("/");
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await page.getByRole("button",{name:/上传截图/}).click();
  await page.getByLabel("食谱截图 - 选择照片或文件").setInputFiles(Array.from({length:30},(_,index)=>({name:`screenshot-${String(index+1).padStart(2,"0")}.png`,mimeType:"image/png",buffer:sample})));
  await expect(page.locator(".screenshot-review li")).toHaveCount(30,{timeout:90_000});
  await expect(page.locator(".screenshot-review li").first()).toHaveAttribute("aria-label",/screenshot-01\.png/);
  await expect(page.locator(".screenshot-review li").last()).toHaveAttribute("aria-label",/screenshot-30\.png/);
  await expect(page.getByText("检测到可能重复的截图",{exact:true})).toBeVisible();
  await page.screenshot({path:"test-results/visual/multi-screenshot-30.png",fullPage:true});
  await page.getByRole("button",{name:"保留两张",exact:true}).click();
  await page.getByLabel("下移截图 1",{exact:true}).click();
  await expect(page.locator(".screenshot-review li")).toHaveCount(30);
  await expect(page.locator(".screenshot-review li").first()).toHaveAttribute("aria-label",/screenshot-02\.png/);
  await expect(page.locator(".screenshot-review li").nth(1)).toHaveAttribute("aria-label",/screenshot-01\.png/);
  await page.getByLabel("删除截图 2",{exact:true}).click();
  await expect(page.locator(".screenshot-review li")).toHaveCount(29);
  await page.getByRole("button",{name:"继续",exact:true}).click();
  await expect(page.getByLabel("OCR 队列")).toContainText("共 29 张");
  await expect(page.getByRole("button",{name:"开始本地 OCR",exact:true})).toBeVisible();
});
