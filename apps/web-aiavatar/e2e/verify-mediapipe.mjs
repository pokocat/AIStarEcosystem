// 验证 MediaPipe 真实检测是否命中（非测试）。node e2e/verify-mediapipe.mjs
import { chromium } from "@playwright/test";

const BASE = "http://localhost:3013";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
page.on("console", (m) => logs.push(m.text()));

await page.goto(`${BASE}/login`);
await page.getByRole("button", { name: "进入工作台" }).click();
await page.getByRole("heading", { name: "资产总库" }).waitFor();

// 打开一个种子归档形象（真实人脸封面）的精调工作台
await page.goto(`${BASE}/avatars/DH-2049/studio`);
await page.getByText("精细化精调").first().waitFor({ timeout: 20000 });

// 等检测完成（最多 ~15s：加载 WASM + 模型 + detect）
let caption = "";
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(700);
  caption = await page.evaluate(() => {
    const els = Array.from(document.querySelectorAll(".mono"));
    const hit = els.find((e) => /MediaPipe|启发式锚点/.test(e.textContent || ""));
    return hit ? hit.textContent.trim() : "";
  });
  if (caption.includes("MediaPipe")) break;
}
console.log("CANVAS CAPTION:", caption || "(未找到)");
console.log("DETECTED:", caption.includes("MediaPipe") ? "✅ 真实关键点命中" : "⚠️ 回退启发式");

await browser.close();
