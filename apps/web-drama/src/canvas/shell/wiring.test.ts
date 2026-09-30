import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CANVAS_STEPS, stepOfPath } from "./canvas-rail";

// §8.0.1 ⑥：写完没人挂的组件，编译器不会告诉你。钉住画布外壳的接线：四屏路由都在、layout 挂着
// CanvasShell（文档 / 生成两个 Provider + 打开前的闸）、竖条三格、全站侧栏入口与沉浸态、样式都导入了。
// 只断结构，不断界面文案（§8.0.1 ⑩）。
const app = (p: string) => resolve(__dirname, "../../app", p);
const read = (p: string) => readFileSync(p, "utf8");

describe("画布外壳接线", () => {
  it("四屏路由 + 列表 + 新建 + 按步骤跳转都在", () => {
    for (const p of [
      "(workspace)/canvas/page.tsx",
      "(workspace)/canvas/new/page.tsx",
      "(workspace)/canvas/[canvasId]/layout.tsx",
      "(workspace)/canvas/[canvasId]/page.tsx",
      "(workspace)/canvas/[canvasId]/script/page.tsx",
      "(workspace)/canvas/[canvasId]/assets/page.tsx",
      "(workspace)/canvas/[canvasId]/episodes/page.tsx",
      "(workspace)/canvas/[canvasId]/episodes/[no]/page.tsx",
    ]) {
      expect(existsSync(app(p)), p).toBe(true);
    }
  });

  it("[canvasId]/layout 等 params（Next 16 是 Promise）并挂 CanvasShell", () => {
    const src = read(app("(workspace)/canvas/[canvasId]/layout.tsx"));
    expect(src).toMatch(/await params/);
    expect(src).toMatch(/<CanvasShell canvasId=\{canvasId\}>/);
  });

  it("CanvasShell：文档 Provider 包生成 Provider，编辑界面在 CanvasGate 里（加载完成前不渲染）", () => {
    const src = read(resolve(__dirname, "canvas-shell.tsx"));
    const doc = src.indexOf("<CanvasDocProvider");
    const runs = src.indexOf("<CanvasRunsProvider");
    const gate = src.indexOf("<CanvasGate>");
    const content = src.indexOf('className="cv-content"');
    expect(doc).toBeGreaterThan(-1);
    expect(runs).toBeGreaterThan(doc);
    expect(gate).toBeGreaterThan(runs);
    expect(content).toBeGreaterThan(gate);
    expect(src).toMatch(/<CanvasRail canvasId=\{canvasId\}/);
  });

  it("竖条三格：剧本 / 角色和场景 / 逐集制作，按路径认得当前一步", () => {
    expect(CANVAS_STEPS.map((s) => s.key)).toEqual(["script", "assets", "episodes"]);
    expect(stepOfPath("/canvas/c1/script", "c1")).toBe("script");
    expect(stepOfPath("/canvas/c1/assets", "c1")).toBe("assets");
    expect(stepOfPath("/canvas/c1/episodes/3", "c1")).toBe("episodes");
    expect(stepOfPath("/canvas/c1", "c1")).toBeNull();
    expect(stepOfPath("/canvas/c2/script", "c1")).toBeNull();
  });

  it("全站侧栏有「画布」入口；/canvas/<id> 及子路由是沉浸态，/canvas 和 /canvas/new 不是", () => {
    const src = read(app("(workspace)/layout.tsx"));
    expect(src).toMatch(/href: "\/canvas", icon: \w+, label: "画布"/);
    const m = src.match(/const canvasMatch = pathname\?\.match\((\/.*\/)\);/);
    expect(m).not.toBeNull();
    // eslint-disable-next-line no-eval
    const re = eval(m![1]) as RegExp;
    const immersive = (p: string) => {
      const x = p.match(re);
      return !!x && x[1] !== "new";
    };
    expect(immersive("/canvas/c1")).toBe(true);
    expect(immersive("/canvas/c1/script")).toBe(true);
    expect(immersive("/canvas/c1/episodes/2")).toBe(true);
    expect(immersive("/canvas")).toBe(false);
    expect(immersive("/canvas/new")).toBe(false);
    expect(src).toMatch(/if \(isWorkshop \|\| isCanvas\)/);
  });

  it("我的画布：封面用 CanvasImage；粘贴新建把切集说明交给剧本页（剧本页页首挂着 SplitNotesBanner）", () => {
    expect(read(app("(workspace)/canvas/page.tsx"))).toMatch(/<CanvasImage\b/);
    expect(read(app("(workspace)/canvas/new/page.tsx"))).toMatch(/rememberSplitNotes\(created\.id, created\.splitNotes\)/);
    expect(read(resolve(__dirname, "../script/script-page.tsx"))).toMatch(/<SplitNotesBanner canvasId=\{canvasId\}/);
  });

  it("首页有画布入口卡；样式文件都在根 layout 里导入", () => {
    expect(read(app("(workspace)/dashboard/page.tsx"))).toMatch(/href="\/canvas"/);
    const root = read(app("layout.tsx"));
    for (const f of ["canvas", "canvas-script", "canvas-assets", "canvas-board", "canvas-episodes"]) {
      expect(root).toContain(`import "../styles/pages/${f}.css";`);
      expect(existsSync(resolve(__dirname, `../../styles/pages/${f}.css`))).toBe(true);
    }
  });
});
