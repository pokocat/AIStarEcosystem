// 视频页不能自成一套样式：卡片、主按钮、配置卡宽度都跟新版场景页（2026-11-06 评审）。
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync(new URL("../../styles/studio-video-workspace.css", import.meta.url), "utf8");

test("不覆盖场景页的主按钮和卡片圆角", () => {
  expect(css).not.toMatch(/\.scene-go\b/);
  expect(css).not.toMatch(/\.scene-card\b[^{]*\{/);
});
test("配置卡和图片页同宽，放得下 400 宽的规格和场景面板", () => {
  expect(css).toMatch(/grid-template-columns: minmax\(360px, 420px\) minmax\(360px, 1fr\) 196px/);
});
test("深底链接用 a.xxx 写字色：单个 class 的优先级低于 .ip-brand-surface a", () => {
  expect(css).toMatch(/a\.video-task-link\.is-primary\) \{[^}]*color: #fff/);
  expect(css).not.toMatch(/(^|[\s,])\.video-task-link[^{]*\{[^}]*color:/m);
});
test("状态色用令牌，不写死色值", () => {
  expect(css).not.toMatch(/#28694f|#a43845/);
});
