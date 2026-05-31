// 截图脚本（非测试）：登录后逐页截图到 /tmp/shots。node e2e/shots.mjs
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3013";
const OUT = "/tmp/shots";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("shot:", name);
}

await page.goto(`${BASE}/login`);
await page.waitForTimeout(1200);
await shot("01-login");
await page.getByRole("button", { name: "进入工作台" }).click();
await page.getByRole("heading", { name: "资产总库" }).waitFor();
await shot("02-library");

await page.goto(`${BASE}/create`);
await page.getByText("纯 AI 原创生成").click();
await shot("03-create");

// open an archived seed avatar detail
await page.goto(`${BASE}/library`);
await page.getByText("林夕").click();
await page.waitForTimeout(1200);
await shot("04-detail");

// drive a quick AI pipeline to reach studio (real warp) + output (real beauty)
await page.goto(`${BASE}/create`);
await page.getByText("纯 AI 原创生成").click();
await page.getByRole("button", { name: "下一步 · 素材准备" }).click();
await page.getByRole("button", { name: "开始打样" }).click();
await page.getByRole("button", { name: "选择此版" }).first().waitFor({ timeout: 60000 });
await shot("05-sampling");
await page.getByRole("button", { name: "选择此版" }).first().click();
await page.getByRole("button", { name: "进入草稿迭代" }).click();
await page.getByTitle("选定").first().click();
await page.getByRole("button", { name: "选定此版 · 进入精调" }).click();
await page.getByRole("button", { name: "进入美化出图" }).waitFor();
await page.waitForTimeout(1500); // let warp render
await shot("06-studio");
await page.getByRole("button", { name: "进入美化出图" }).click();
await page.getByRole("button", { name: "批量出标准图" }).click();
await page.getByRole("button", { name: "前往定稿" }).waitFor({ timeout: 60000 });
await shot("07-output-beauty");

await page.goto(`${BASE}/health`);
await page.waitForTimeout(1200);
await shot("08-health");

await page.goto(`${BASE}/tasks`);
await page.waitForTimeout(1000);
await shot("09-tasks");

await browser.close();
console.log("done");
