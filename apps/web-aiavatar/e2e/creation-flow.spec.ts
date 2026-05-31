import { test, expect, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// 端到端（任务书 §8）：APP_MODE=dev / NEXT_PUBLIC_USE_MOCK=1（全 mock，可离线）。
// 两条创建路径各自从「新建」跑到「入库归档」，断言每步产出物 / 状态机流转。
// ─────────────────────────────────────────────────────────────────────────────

async function devLogin(page: Page) {
  await page.goto("/login");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { name: "资产总库" })).toBeVisible();
}

/** 从「打样结果」一路跑到「正式归档」（两路径共用后段）。 */
async function runPipelineToArchive(page: Page) {
  // STEP 03 打样：等候选图（任务完成）→ 单选 → 进入草稿迭代
  await expect(page.getByRole("button", { name: "选择此版" }).first()).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "选择此版" }).first().click();
  await page.getByRole("button", { name: "进入草稿迭代" }).click();

  // STEP 04 草稿迭代：选定初始版本 → 进入精调
  await page.getByTitle("选定").first().click();
  await page.getByRole("button", { name: "选定此版 · 进入精调" }).click();

  // STEP 05 精调（五官微调 / 模版套用）：实时几何形变 → 进入分视角出图
  await expect(page.getByRole("button", { name: "进入分视角出图" })).toBeVisible();
  await page.getByRole("button", { name: "进入分视角出图" }).click();

  // STEP 06 标准分视角出图：批量出图 → 前往定稿
  await page.getByRole("button", { name: "批量出标准图" }).click();
  await expect(page.getByRole("button", { name: "前往定稿" })).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "前往定稿" }).click();

  // STEP 07 定稿：全部确认 → 锁定定稿 → 成功
  await page.getByRole("button", { name: "全部确认" }).click();
  await expect(page.getByRole("button", { name: "锁定定稿" })).toBeEnabled();
  await page.getByRole("button", { name: "锁定定稿" }).click();
  await expect(page.getByText("已成功定稿")).toBeVisible();

  // STEP 08 衍生：生成衍生资产 → 选 3D → 生成 → 入库归档
  await page.getByRole("button", { name: "生成衍生资产" }).click();
  await page.getByTestId("derive-toggle-3d").click();
  await page.getByRole("button", { name: "生成衍生资产" }).click();
  await expect(page.getByRole("button", { name: "确认入库 · 完成归档" })).toBeVisible({ timeout: 90_000 });
  await page.getByRole("button", { name: "确认入库 · 完成归档" }).click();

  // 资产详情：状态机已到「正式归档」
  await expect(page.getByText("正式归档").first()).toBeVisible({ timeout: 20_000 });
}

test("资产总库展示种子真人形象", async ({ page }) => {
  await devLogin(page);
  // 种子人像图片加载（真实开源照片）
  await expect(page.locator('img[src^="/seed/portrait-"]').first()).toBeVisible();
  await expect(page.getByText("林夕")).toBeVisible();
});

test("AI 原创：从新建到入库归档", async ({ page }) => {
  await devLogin(page);
  await page.getByRole("button", { name: "新建数字人" }).first().click();

  // STEP 01 选择模式
  await page.getByText("纯 AI 原创生成").click();
  await page.getByRole("button", { name: "下一步 · 素材准备" }).click();

  // STEP 02 人设文案（已预填）→ 开始打样
  await expect(page.getByRole("button", { name: "开始打样" })).toBeEnabled();
  await page.getByRole("button", { name: "开始打样" }).click();

  await runPipelineToArchive(page);
});

test("真人复刻：从新建（上传+授权）到入库归档", async ({ page }) => {
  await devLogin(page);
  await page.getByRole("button", { name: "新建数字人" }).first().click();

  // STEP 01 选择模式
  await page.getByText("真人授权复刻").click();
  await page.getByRole("button", { name: "下一步 · 素材准备" }).click();

  // STEP 02 上传示例照片（合规检测）+ 签署授权 → 开始打样
  await page.getByRole("button", { name: "使用示例照片" }).click();
  await expect(page.getByText("✓ 合规").first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("checkbox").check();
  await expect(page.getByRole("button", { name: "开始打样" })).toBeEnabled({ timeout: 20_000 });
  await page.getByRole("button", { name: "开始打样" }).click();

  await runPipelineToArchive(page);
});
