// 「已受理的生成能不能接回来」这条链的**接线**测试（v0.179）。
//
// 为什么是结构测试：这几处判断都在 `canvas/pages/canvas/project.tsx` 里 ——
// 一个 3000 行、依赖 antd + i18n + next/navigation 的画布页，渲染它去测一行判断
// 不现实。而这些判断错了都不会报错，只会安静地丢东西（服务端跑完、扣了钱、产物没人认领）。
// 行为侧的部分（`resumeRun` 只读运行、`resetInterruptedGeneration` 不标可恢复的那些）
// 分别在 generation.test.ts 与 retry-and-resume.test.ts 里真跑。

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const page = readFileSync(join(__dirname, "../canvas/pages/canvas/project.tsx"), "utf8");

describe("视频任务号必须存下来", () => {
  it("不再按 provider 分叉 —— 本仓的 provider 恒为 plugin（服务端任务）", () => {
    // 上游：`if (task.provider !== "plugin")` 才存（它的 plugin 是浏览器插件，存了也接不回）。
    // 我们的 plugin 是服务端的 MaterialVideoJob —— 这行判断让 videoTaskId 一次都没被存过，
    // 于是「刷新后接着轮询」那个 effect 从来没生效过。
    // 只看代码行 —— 上面那段注释里引用了这个旧判断，正是在解释为什么不能留它
    const codeLines = page.split("\n").map((l) => l.trim()).filter((l) => !l.startsWith("//") && !l.startsWith("*"));
    expect(codeLines.some((l) => l.startsWith("if (task.provider"))).toBe(false);
    expect(page).toContain("videoTaskId: task.id");
  });

  it("刷新后仍按 videoTaskId 接回", () => {
    expect(page).toContain("filter(hasResumableVideoTask)");
    expect(page).toContain("pollVideoNodeTask(node, true)");
  });
});

describe("出图运行号必须存下来并接回", () => {
  it("受理时就把运行号写进候选（onAccepted → rememberImageRun）", () => {
    expect(page).toContain("rememberImageRun");
  });

  it("**每一个**付费出图入口都挂了 onAccepted —— 漏一个就是那条链的产物找不回来", () => {
    // v0.179 复核（Codex #10）：第一版只接了「普通生成」和「单张重试」，
    // 而蒙版编辑（maskEditImageNode）与视角变化（generateAngleNode）也是付费的
    // requestEdit 入口。这里把「所有 requestEdit / requestGeneration 调用都带 onAccepted」
    // 钉死：新增一个付费入口忘了接，这条就红。
    const calls = [...page.matchAll(/await (requestEdit|requestGeneration)\(([\s\S]*?)\)\s*(?:\.then|;)/g)];
    expect(calls.length).toBeGreaterThanOrEqual(6);   // 普通生成 ×2（edit/generation）+ 重试 ×2 + 蒙版 + 视角
    const withoutRunId = calls.filter(([, , args]) => !args.includes("onAccepted"));
    expect(withoutRunId.map(([m]) => m.slice(0, 60))).toEqual([]);
  });

  it("没有候选数组的那两条（蒙版 / 视角）把运行号记在节点级 metadata.runId 上", () => {
    // 它们建的节点没有 images[]，结果直接写进 metadata —— 运行号只能挂节点级。
    expect(page).toMatch(/metadata: \{ \.\.\.item\.metadata, runId \}/);
  });

  it("进画布时接着轮询留了运行号的候选", () => {
    expect(page).toContain("filter(hasResumableImageRun)");
    expect(page).toContain("resumeImageNodeRun(node)");
  });

  it("接回走的是 resumeRun（只读运行），不是重新 requestEdit（那就是再扣一次钱）", () => {
    expect(page).toContain("resumeRun(runId");
    const resumeBlock = page.slice(page.indexOf("const resumeImageNodeRun"), page.indexOf("const stopGenerationByRunningId"));
    expect(resumeBlock).not.toContain("requestEdit");
    expect(resumeBlock).not.toContain("requestGeneration");
  });
});

describe("上传入口只列真能收的格式", () => {
  it("accept 用共用常量，不再是 image/*,video/*", () => {
    expect(page).toContain("accept={UPLOAD_ACCEPT}");
    expect(page).not.toContain('accept="image/*,video/*');
  });

  it("上传失败要把服务端的原话给用户，不能 void 掉", () => {
    expect(page).not.toMatch(/void create(Video|Audio)FileNode/);
    expect(page).toContain("importImageFiles");
  });
});
