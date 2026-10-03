import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { editPromptVars, type ImageEditKind } from "./ai-image-edit-modal";

// 断契约：改图要求必须落进服务端模板**真正读的**占位符里。服务端 fill 之后会把没填上的 {{x}} 清掉，
// 键名对不上 = 用户说的「换成夜景」静默丢失（v0.197 评审 EP3：以前发的是 vars.desc，模板读 {{visual}}）。
const PROMPTS = resolve(__dirname, "../../../../server/src/main/resources/prompts/material");
const TEMPLATE: Record<ImageEditKind, string> = {
  shot: "drama.frame_image.md",
  short: "drama.short_frame_image.md",
  scene: "drama.scene_frame_image.md",
};
const placeholders = (file: string) =>
  new Set(Array.from(readFileSync(resolve(PROMPTS, file), "utf8").matchAll(/\{\{\s*([\w.]+)\s*\}\}/g), (m) => m[1]));

describe("editPromptVars", () => {
  for (const kind of Object.keys(TEMPLATE) as ImageEditKind[]) {
    it(`${kind}：改图要求进了模板读的变量，发出去的每个键模板里都有`, () => {
      const used = placeholders(TEMPLATE[kind]);
      const vars = editPromptVars(kind, "雨夜的天台", "换成白天", "天台");
      for (const key of Object.keys(vars)) expect(used.has(key)).toBe(true);
      const carrying = Object.entries(vars).filter(([, v]) => v.includes("换成白天")).map(([k]) => k);
      expect(carrying.length).toBe(1);
      expect(used.has(carrying[0])).toBe(true);
    });
  }
});

// 调用方各自传对了模板（kind 是必填 prop，漏传编译不过；这里钉住传的是哪一个）：
// 场景图走 scene（空景模板，明确画面里不要人），短视频分镜走 short，短剧分镜走 shot。
describe("AiImageEditModal 调用方", () => {
  const CALLERS: Array<[string, ImageEditKind]> = [
    ["./storyboard-table.tsx", "shot"],
    ["./short-storyboard-table.tsx", "short"],
    ["./stages/cast/index.tsx", "scene"],
  ];
  for (const [file, kind] of CALLERS) {
    it(`${file} 传 kind="${kind}"`, () => {
      const src = readFileSync(resolve(__dirname, file), "utf8");
      const uses = Array.from(src.matchAll(/<AiImageEditModal\b([\s\S]*?)\/>/g), (m) => m[1]);
      expect(uses.length).toBeGreaterThan(0);
      for (const u of uses) expect(u).toMatch(new RegExp(`\\bkind="${kind}"`));
    });
  }
});
