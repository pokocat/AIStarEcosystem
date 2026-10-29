import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { studioBriefNeedsReference } from "../studio-entry";
import { IMAGE_DRAFT_SUFFIX, VIDEO_DRAFT_SUFFIX, composeVideoBrief, homeGoals, imagePrompt, imageScene, imageScenes, sceneCover, sceneFromDraftName, videoScene, videoScenes } from "./scene-catalog";

const PUBLIC = join(__dirname, "../../../public");

test("every scene has a unique id and a cover image that ships with the app", () => {
  const ids = [...imageScenes, ...videoScenes].map(s => s.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(existsSync(join(PUBLIC, sceneCover(id))), id).toBe(true);
});

test("an image prompt only names reference slots the scene has, and never leaves a blank for the user to fill", () => {
  for (const scene of imageScenes) {
    const named = [...scene.prompt.matchAll(/图(\d)/g)].map(m => Number(m[1]));
    for (const n of named) expect(n, `${scene.id} 写了图${n}`).toBeLessThanOrEqual(scene.refs.length);
    // 必填的参考图排在前面：图1 永远是用户一定会放的那张。
    expect(scene.refs[0]?.required, scene.id).toBe(true);
    // 描述不摆给用户看，所以不能留【…】让人填；要用户决定的写成「按补充要求」。
    expect(scene.prompt, scene.id).not.toMatch(/[【】]/);
    expect(scene.hint.length, scene.id).toBeGreaterThan(4);
  }
});

test("the prompt sent is the scene description plus what the user added; free drawing sends only the user's words", () => {
  const scene = imageScene("face-turnaround")!;
  expect(imagePrompt(scene, { supplement: "" })).toBe(scene.prompt);
  expect(imagePrompt(scene, { supplement: " 自然微笑 " })).toBe(`${scene.prompt}\n补充要求：自然微笑`);
  expect(imagePrompt(scene, { supplement: "", custom: "我自己写的" })).toBe("我自己写的");
  expect(imagePrompt(imageScene("free")!, { supplement: "一只猫" })).toBe("一只猫");
});

test("the brief carries the user's line and materials, and forbids inventing prices or offers", () => {
  const scene = videoScene("ecom-talking")!;
  const brief = composeVideoBrief(scene, { text: "保湿精华，不黏腻", duration: 25, ratio: "9:16", imageTitles: ["商品图 1"] });
  expect(brief).toContain("25 秒的竖屏");
  expect(brief).toContain("我的要求：保湿精华，不黏腻");
  expect(brief).toContain("「商品图 1」");
  expect(brief).toMatch(/没写的信息.*不要自己编/);
  const silent = composeVideoBrief(scene, { text: " ", duration: 25, ratio: "9:16", imageTitles: ["商品图 1"] });
  expect(silent).not.toContain("我的要求");
  expect(silent).toContain("先看素材");
});

// The canvas holds back a brief that asks to copy a reference video until the video is there (studio-entry.ts).
// Only 爆款复刻 may trip that rule; every other scene must be sent straight away.
test("only 爆款复刻 is held back for a reference video; every other scene is sent on arrival", () => {
  for (const scene of videoScenes) {
    const brief = composeVideoBrief(scene, { text: scene.ideas.join("；"), duration: scene.duration, ratio: scene.ratio,
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
