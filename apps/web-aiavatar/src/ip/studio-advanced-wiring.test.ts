import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";

// 编辑室要真的打开才渲染（Twick 只在浏览器里跑），这里钉住几处挂载关系，交互在浏览器走查。
const source = readFileSync(join(__dirname, "studio-advanced-editor.tsx"), "utf8");

test("with nothing selected the right panel shows the cut, not a page of instructions", () => {
  expect(source).toContain("{!el ? <CutOverview");
});

test("a selected item can get back to the clip list from the top of the panel", () => {
  expect(source).toContain('className="studio-advanced-all" onClick={() => setSelectedItem(null)}');
});

test("the right panel and the left panels share one music value and one caption switch", () => {
  expect(source).toContain("music={music} auto={autoCaptions}");
});
