import { test, expect, type Page } from "@playwright/test";

// ─────────────────────────────────────────────────────────────────────────────
// 运营配置能力（NEXT_PUBLIC_USE_MOCK=1，离线）：
//   · operatorRole 门控（运营可见 /config、非运营跳回 /library）
//   · Prompt 模板编辑 + 试运行
//   · 风格 / 妆造模板 CRUD
//   · 快捷指令 / 默认人设 + 标准构图 CRUD
// ─────────────────────────────────────────────────────────────────────────────

async function devLoginAsOperator(page: Page) {
  await page.goto("/login");
  await page.getByText("体验账号").click();
  await page.getByText("以平台运营身份进入").click();
  await page.getByRole("button", { name: "以运营身份进入" }).click();
  await expect(page.getByRole("heading", { name: "资产总库" })).toBeVisible();
}

test("运营门控：运营可见配置入口，非运营被拦截", async ({ page }) => {
  // 普通创作者
  await page.goto("/login");
  await page.getByText("体验账号").click();
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("heading", { name: "资产总库" })).toBeVisible();
  await expect(page.getByRole("link", { name: "运营配置" })).toHaveCount(0);
  await page.goto("/config");
  await expect(page).toHaveURL(/\/library$/, { timeout: 10_000 });
});

test("运营配置：Prompt 模板编辑 + 试运行", async ({ page }) => {
  await devLoginAsOperator(page);
  await expect(page.getByRole("link", { name: "运营配置" })).toBeVisible();
  await page.goto("/config");
  await expect(page.getByRole("heading", { name: "运营配置" })).toBeVisible();

  await page.getByText("人设文案解析").first().click();
  await page.locator("textarea").first().fill("【运营改写】把人设抽取为 JSON。");
  await page.getByRole("button", { name: "保存" }).first().click();
  await page.getByRole("button", { name: "试运行" }).click();
  await expect(page.locator("pre")).toBeVisible();
});

test("运营配置：新增风格/妆造模板 → 创作者精调可选用", async ({ page }) => {
  await devLoginAsOperator(page);
  await page.goto("/config");
  await page.getByRole("button", { name: "风格 / 妆造模板" }).click();
  await page.getByRole("button", { name: "新增模板" }).click();
  await page.getByPlaceholder("如：职业妆容").fill("E2E·赛博妆");
  await page.locator("textarea").first().fill("赛博朋克霓虹妆容，保留五官结构");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(page.getByText("E2E·赛博妆")).toBeVisible();

  // 创作者侧：新建 AI 形象 → 打样选版 → 草稿选版 → 精调「模版套用」能看到运营新增的模板
  await page.goto("/create");
  await page.getByText("纯 AI 原创生成").click();
  await page.getByRole("button", { name: "下一步 · 素材准备" }).click();
  await page.getByRole("button", { name: "开始打样" }).click();
  await page.getByRole("button", { name: "选择此版" }).first().click({ timeout: 60_000 });
  await page.getByRole("button", { name: "进入草稿迭代" }).click({ force: true });
  await page.getByTitle("选定").first().click();
  await page.getByRole("button", { name: "选定此版 · 进入精调" }).click();
  await page.getByRole("button", { name: "模版套用" }).click();
  await expect(page.getByText("E2E·赛博妆")).toBeVisible({ timeout: 10_000 });
});

test("运营配置：快捷指令 / 默认人设 + 标准构图区可用", async ({ page }) => {
  await devLoginAsOperator(page);
  await page.goto("/config");
  await page.getByRole("button", { name: "构图 / 快捷指令" }).click();
  await expect(page.getByText("草稿迭代 · 快捷指令")).toBeVisible();
  await expect(page.getByText("标准构图视角")).toBeVisible();
  // 新增一个快捷指令并保存
  const input = page.getByPlaceholder("输入后回车添加").first();
  await input.fill("E2E指令");
  await input.press("Enter");
  await page.getByRole("button", { name: "保存" }).first().click();
  await expect(page.getByText("E2E指令")).toBeVisible();
});
