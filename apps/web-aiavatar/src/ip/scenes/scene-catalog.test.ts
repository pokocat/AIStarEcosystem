import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { StudioSceneCatalog } from "@ai-star-eco/types";
import { sceneCover, sceneHref } from "./scene-catalog";
import { MOCK_SCENES } from "../mocks/scenes";

// 场景目录的唯一真源在服务端；拼话规则的测试在 StudioSceneCatalogTest（Java）。这里只核前端引用的那几样对得上。
const PUBLIC = join(__dirname, "../../../public");
const SERVER: StudioSceneCatalog = JSON.parse(readFileSync(join(__dirname, "../../../../server/src/main/resources/ipstudio/scenes.json"), "utf8"));

test("every scene on the server has a cover image shipped with the app", () => {
  for (const s of [...SERVER.image, ...SERVER.video]) if (s.id !== "free") expect(existsSync(join(PUBLIC, sceneCover(s.id))), s.id).toBe(true);
});

test("every built-in home card opens a scene the server knows, with covers shipped with the app", () => {
  const goals = SERVER.homeGoals ?? [];
  expect(goals.length).toBeGreaterThan(0);
  for (const goal of goals) {
    const kind = SERVER.image.some(s => s.id === goal.sceneId) ? "image" : "video";
    const url = new URL(sceneHref({ kind, sceneId: goal.sceneId }), "http://x");
    const list = url.pathname === "/image" ? SERVER.image : SERVER.video;
    expect(list.some(s => s.id === url.searchParams.get("scene")), goal.id).toBe(true);
    for (const cover of goal.covers ?? []) expect(existsSync(join(PUBLIC, sceneCover(cover))), cover).toBe(true);
  }
});

// 演示模式的样本也照服务端的形状写（§8.0.1 ⑦）：字段一样，场景编号也得是真的。
test("the demo-mode catalog has the server's shape and only real scene ids", () => {
  const keys = (o: object) => Object.keys(o).sort();
  expect(keys(MOCK_SCENES)).toEqual(keys(SERVER).filter(k => k !== "_comment"));
  for (const s of MOCK_SCENES.image) {
    const real = SERVER.image.find(r => r.id === s.id);
    expect(real, s.id).toBeTruthy();
    expect(keys(s)).toEqual(keys(real!));
  }
  for (const s of MOCK_SCENES.video) {
    const real = SERVER.video.find(r => r.id === s.id);
    expect(real, s.id).toBeTruthy();
    expect(keys(s)).toEqual(keys(real!));
  }
});
