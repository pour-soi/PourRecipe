import {expect,test} from "@playwright/test";
import path from "node:path";

const imagePath=path.resolve("public/pwa-192.png");
const ocrImagePath=path.resolve("tests/assets/ocr-sample.png");

test("real browser OCR starts only after a click and keeps raw and edited text",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  test.setTimeout(180_000);
  await page.goto("/");
  await page.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await page.getByRole("button",{name:/上传截图/}).click();
  await page.getByLabel("食谱截图 - 选择照片或文件").setInputFiles([ocrImagePath,ocrImagePath]);
  await page.getByRole("button",{name:"继续",exact:true}).click();
  await page.getByLabel("名称",{exact:true}).fill(`OCR-${Date.now()}`);
  await page.getByLabel("识别语言").first().selectOption("eng");
  await page.getByRole("button",{name:"识别文字",exact:true}).first().click();
  await page.getByText("查看完整 OCR 原文",{exact:true}).click();
  await expect(page.getByLabel("原始识别结果").first()).toContainText("APPLE",{timeout:120_000});
  await page.getByLabel("识别语言").nth(1).selectOption("eng");
  await page.context().setOffline(true);
  await page.getByRole("button",{name:"识别文字",exact:true}).nth(1).click();
  await expect(page.getByLabel("原始识别结果").nth(1)).toContainText("APPLE",{timeout:120_000});
  await page.context().setOffline(false);
  await page.getByLabel("OCR 可编辑副本").first().fill("Apple Pie\nflour 500 g\n1. Mix and bake at 180℃");
  await expect(page.getByRole("button",{name:"智能整理",exact:true}).first()).toBeVisible();
  await expect(page.getByText("只发送你确认过的 OCR 文字；不会发送截图。",{exact:false})).toBeVisible();
  await expect(page.getByLabel("本次同时发送截图")).toHaveCount(0);
  await expect(page.getByText("结构化解析预览",{exact:true}).first()).toBeVisible();
  await expect(page.locator(".parser-preview").first()).toContainText("quantity-unit");
  await expect(page.locator(".parser-preview").first()).toContainText("cooking-verb");
  await page.screenshot({path:"test-results/visual/ocr-review-390.png",fullPage:true});
  await expect(page.getByLabel("原始识别结果").first()).toContainText("APPLE");
  await expect(page.getByLabel("OCR 可编辑副本").first()).toHaveValue("Apple Pie\nflour 500 g\n1. Mix and bake at 180℃");
});

test("offline data survives refresh and a ZIP restores in a fresh context",async({browser})=>{
  const name=`离线食谱-${Date.now()}`,deviceA=await browser.newContext({acceptDownloads:true}),a=await deviceA.newPage();
  await a.goto("/");await a.evaluate(()=>navigator.serviceWorker.ready);await deviceA.setOffline(true);
  await a.locator(".page-header").getByRole("button",{name:"新增食谱",exact:true}).click();
  await a.getByRole("button",{name:/手动输入/}).click();
  await a.getByLabel("名称",{exact:true}).fill(name);
  await a.getByLabel("食材 1",{exact:true}).fill("番茄 2 个");
  await a.getByLabel("步骤 1",{exact:true}).fill("切好后混合");
  await a.getByLabel("封面图片（可选） - 从相册选择").setInputFiles(imagePath);
  await a.getByRole("button",{name:"保存",exact:true}).click();await expect(a.getByRole("heading",{name:"编辑食谱",exact:true})).toBeVisible();
  await a.getByRole("button",{name:"保存",exact:true}).click();await expect(a.getByRole("heading",{name,exact:true,level:1})).toBeVisible();await expect(a.getByText("没做过",{exact:true}).first()).toBeVisible();await a.reload();
  await expect(a.getByRole("heading",{name,exact:true,level:3})).toBeVisible();
  await a.locator(".bottom-nav a", {hasText:"设置"}).click();await expect(a.getByText("未登录",{exact:true}).first()).toBeVisible();
  if(await a.getByRole("button",{name:/登录方式/}).count()){
    await a.getByRole("button",{name:/登录方式/}).click();
    await expect(a.getByRole("button",{name:"登录",exact:true})).toBeVisible();
    await expect(a.getByLabel("密码")).toBeVisible();
    await a.getByRole("button",{name:"邮箱登录链接",exact:true}).click();
    await expect(a.getByRole("button",{name:"发送邮箱登录链接"})).toBeVisible();
    await expect(a.getByLabel("邮箱")).toBeVisible();
    await expect(a.getByLabel("验证码")).toHaveCount(0);
  }
  await a.getByRole("button",{name:"完成"}).click();
  await expect(a.getByText(/仅在你确认后发送 OCR 文字/)).toBeVisible();
  await deviceA.setOffline(false);
  const downloadPromise=a.waitForEvent("download");await a.getByRole("button",{name:"导出完整 ZIP"}).click();
  const download=await downloadPromise,backupPath=path.resolve("test-results/pourrecipe-e2e.zip");await download.saveAs(backupPath);

  const deviceB=await browser.newContext(),b=await deviceB.newPage();await b.goto("/");await b.locator(".bottom-nav a", {hasText:"设置"}).click();
  await b.getByLabel("选择 PourRecipe ZIP").setInputFiles(backupPath);b.once("dialog",dialog=>dialog.accept("合并"));await b.getByRole("button",{name:"验证并导入"}).click();
  await expect(b.getByText(/导入完成/)).toBeVisible();await b.reload();await b.getByRole("link",{name:"食谱",exact:true}).click();await expect(b.getByRole("heading",{name,exact:true})).toBeVisible();
  await deviceA.close();await deviceB.close();
});
