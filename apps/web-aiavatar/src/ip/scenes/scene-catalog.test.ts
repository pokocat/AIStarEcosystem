import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { studioBriefNeedsReference } from "../studio-entry";
import { IMAGE_DRAFT_SUFFIX, VIDEO_DRAFT_SUFFIX, composeVideoBrief, homeGoals, imageScene, imageScenes, sceneCover, sceneFromDraftName, videoScene, videoScenes } from "./scene-catalog";

const PUBLIC = join(__dirname, "../../../public");

test("every scene has a unique id and a cover image that ships with the app", () => {
  const ids = [...imageScenes, ...videoScenes].map(s => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(existsSync(join(PUBLIC, sceneCover(id))), id).toBe(true);
});

test("an image prompt only names reference slots the scene actually has", () => {
  for (const scene of imageScenes) {
    const named = [...scene.prompt.matchAll(/图(\d)/g)].map(m => Number(m[1]));
    for (const n of named) expect(n, `${scene.id} 写了图${n}`).toBeLessThanOrEqual(scene.refs.length);
    // 必填的参考图排在前面：图1 永远是用户一定会放的那张。
    expect(scene.refs[0]?.required, scene.id).toBe(true);
  }
});

test("the brief only says what was filled in, and forbids inventing prices or offers", () => {
  const scene = videoScene("ecom-talking")!;
  const brief = composeVideoBrief(scene, { values: { product: "保湿精华", points: "不黏腻", offer: " " }, extra: "", duration: 25, ratio: "9:16", imageTitles: ["商品图 1"] });
  expect(brief).toContain("25 秒的竖屏");
  expect(brief).toContain("商品：保湿精华");
  expect(brief).not.toContain("优惠：");
  expect(brief).toContain("「商品图 1」");
  expect(brief).toMatch(/没写的信息.*不要自己编/);
});

// The canvas holds back a brief that asks to copy a reference video until the video is there (studio-entry.ts).
// Only 爆款复刻 may trip that rule; every other scene must be sent straight away.
test("only 爆款复刻 is held back for a reference video; every other scene is sent on arrival", () => {
  for (const scene of videoScenes) {
    const values = Object.fromEntries(scene.fields.map(f => [f.id, "示例"]));
    const brief = composeVideoBrief(scene, { values, extra: scene.ideas.join("；"), duration: scene.duration, ratio: scene.ratio,
      imageTitles: [`${scene.images.label} 1`], characterTitle: "出镜人物", voiceTitle: "声音样本", videoTitle: scene.video ? "参考视频" : undefined });
    expect(studioBriefNeedsReference(brief), scene.id).toBe(scene.id === "recreation");
  }
});

test("drafts are recognised by their name, including a subject after the scene title", () => {
  expect(sceneFromDraftName(`脸部三视图${IMAGE_DRAFT_SUFFIX}`, IMAGE_DRAFT_SUFFIX, imageScenes)?.id).toBe("face-turnaround");
  expect(sceneFromDraftName(`口播带货 · 保湿精华${VIDEO_DRAFT_SUFFIX}`, VIDEO_DRAFT_SUFFIX, videoScenes)?.id).toBe("ecom-talking");
  expect(sceneFromDraftName("口播带货 · 保湿精华", VIDEO_DRAFT_SUFFIX, videoScenes)).toBeUndefined();
});

test("every home goal opens an existing scene", () => {
  for (const goal of homeGoals) {
    const url = new URL(goal.href, "http://x");
    const id = url.searchParams.get("scene");
    expect(url.pathname === "/image" ? imageScene(id) : videoScene(id), goal.id).toBeTruthy();
    for (const cover of goal.covers) expect(existsSync(join(PUBLIC, sceneCover(cover))), cover).toBe(true);
  }
});
