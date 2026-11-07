// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, expect, test, vi } from "vitest";
import { writeSceneQuery } from "../ip/scenes/scene-query";
import { CANVAS_RETURN_DEFAULT, canvasReturnText, isCanvasPath, readCanvasReturn, rememberCanvasReturn } from "./canvas-return";

beforeEach(() => { window.sessionStorage.clear(); });

test("the scene pages are remembered with their scene and draft, so the page can restore that draft", () => {
  rememberCanvasReturn("/video", "scene=ecom-talking&draft=IPP-1");
  expect(readCanvasReturn()).toEqual({ href: "/video?scene=ecom-talking&draft=IPP-1", label: "AI 视频" });
  rememberCanvasReturn("/image", "scene=free&draft=IPP-2");
  expect(readCanvasReturn()).toEqual({ href: "/image?scene=free&draft=IPP-2", label: "AI 图片" });
});

// 草稿是在场景页上现场产生的时候，地址走 replaceState，Next 不同步给 useSearchParams。外壳看不到，得由写地址的地方记下。
test("a draft created on the scene page is remembered, so returning does not land on an empty page", () => {
  rememberCanvasReturn("/video", "scene=a");
  writeSceneQuery("/video", "a", "IPP-new");
  expect(window.location.pathname + window.location.search).toBe("/video?scene=a&draft=IPP-new");
  expect(readCanvasReturn()).toEqual({ href: "/video?scene=a&draft=IPP-new", label: "AI 视频" });
  writeSceneQuery("/image", "b", "IPP-other");
  expect(readCanvasReturn()).toEqual({ href: "/image?scene=b&draft=IPP-other", label: "AI 图片" });
});

test.each([
  ["/projects", "项目"], ["/create", "画布"], ["/dashboard", "首页"], ["/", "首页"], ["/assets", "资产"], ["/assets/AV-1", "资产"],
  ["/director", "短剧导演台"], ["/director/DW-1", "短剧导演台"], ["/templates", "灵感"], ["/projects/demos", "灵感"], ["/distribution", "发行"],
])("%s returns under the name the navigation uses", (path, label) => {
  rememberCanvasReturn(path, "");
  expect(readCanvasReturn()).toEqual({ href: path, label });
});

test("moving between canvases or refreshing one keeps the page the first canvas was opened from", () => {
  rememberCanvasReturn("/video", "scene=a&draft=IPP-1");
  rememberCanvasReturn("/projects/IPP-1", "start=assistant&send=1");
  rememberCanvasReturn("/projects/IPP-2", "");
  expect(readCanvasReturn().href).toBe("/video?scene=a&draft=IPP-1");
});

test("a page that cannot be returned to clears the record instead of leaving an older, unrelated page", () => {
  rememberCanvasReturn("/video", "scene=a");
  rememberCanvasReturn("/login", "next=%2Fprojects%2FIPP-1");
  expect(readCanvasReturn()).toEqual(CANVAS_RETURN_DEFAULT);
});

test("a canvas opened directly, with nothing remembered, returns to the project list", () => {
  expect(readCanvasReturn()).toEqual({ href: "/projects", label: "项目" });
});

test.each(["https://evil.example/video", "//evil.example/video", "/login", "/projects/IPP-1"])("a stored %s is not followed", stored => {
  window.sessionStorage.setItem("studio:canvas-return", stored);
  expect(readCanvasReturn()).toEqual(CANVAS_RETURN_DEFAULT);
});

test("blocked storage falls back to the project list and does not throw", () => {
  const blocked = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  const blockedSet = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  try {
    expect(() => rememberCanvasReturn("/video", "")).not.toThrow();
    expect(readCanvasReturn()).toEqual(CANVAS_RETURN_DEFAULT);
  } finally { blocked.mockRestore(); blockedSet.mockRestore(); }
});

test("only /projects/{id} counts as a canvas", () => {
  expect(isCanvasPath("/projects/IPP-1")).toBe(true);
  expect(isCanvasPath("/projects/IPP-1/")).toBe(true);
  for (const path of ["/projects", "/projects/", "/projects/demos", "/projects/demos/", "/video"]) expect(isCanvasPath(path), path).toBe(false);
});

// §8.0.1 ⑥：写完没人挂，编译器不会说。桌面和手机上的三处返回都要读同一个目的地。
test("every way back out of the canvas reads the remembered page", () => {
  const read = (file: string) => readFileSync(join(__dirname, "..", file), "utf8");
  const canvas = read("ip/studio-flow-canvas.tsx");
  expect(canvas).toContain("useState(readCanvasReturn)");
  expect(canvas).toContain("href={back.href}");
  expect(canvas).not.toContain('<a href="/projects"');
  const gate = read("ip/canvas-gate.tsx");
  expect(gate.match(/href=\{back\.href\}/g)).toHaveLength(2);
  expect(gate).not.toContain('href="/projects"');
  // 手机上细栏和画布顶栏各有一个返回会重复（2026-11-07 用户指出），只留细栏上带名字的那个。
  expect(read("styles/studio-flow.css")).toContain('html:not([data-layout="desktop"]) .studio-flow-header>.studio-flow-back { display:none; }');
});

test("names the page on the button, with a space between Chinese and English", () => {
  expect(canvasReturnText("AI 视频")).toBe("返回 AI 视频");
  expect(canvasReturnText("项目")).toBe("返回项目");
});
