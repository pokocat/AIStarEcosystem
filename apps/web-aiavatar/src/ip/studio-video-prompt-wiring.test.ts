// @vitest-environment node
// Structural guards for the video prompt aids (AGENTS.md §8.0.1 ⑥): the pieces are mounted where the user meets them,
// the frame question sits before any document save or paid request, and the request carries the user's choice.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), "src", path), "utf8");

test("the composer, the run input view and the dialog are mounted", () => {
  const workspace = read("ip/studio-workspace.tsx");
  expect(workspace).not.toContain("StudioVideoPromptNote");
  expect(workspace).toMatch(/runDetail\.kind==="studio-video"&&<StudioVideoRewriteDetail run=\{runDetail\}\/>/);
  expect(workspace).toMatch(/<StudioFrameIntentDialog intent=\{frameIntent\?\.intent\}/);
  expect(read("ip/studio-video-controls.tsx")).toMatch(/model\.supportsPromptOptimization&&<div className="studio-video-prompt-mode">/);
  expect(read("ip/studio-task-list.tsx")).not.toContain("studioRunRewrites(run)");
});

test("the frame question is asked before saving the document or submitting, and the choice reaches the request", () => {
  const workspace = read("ip/studio-workspace.tsx");
  const submit = workspace.slice(workspace.indexOf("const submit = async () => {"), workspace.indexOf("const importScript = async"));
  const asked = submit.indexOf("studioFrameIntent(requestPrompt,videoSettings,nativeModeSpec)");
  expect(asked).toBeGreaterThan(0);
  expect(asked).toBeLessThan(submit.indexOf("setBusy(true)"));
  expect(asked).toBeLessThan(submit.indexOf("await saveStudioDocument(projectId)"));
  expect(asked).toBeLessThan(submit.indexOf("await submitStudioRun(projectId, request)"));
  expect(submit).toMatch(/if\(choice==="cancel"\)return;\s*if\(choice==="bind"\)\{bindFramesFor\(intent\);return;\}/);
  expect(workspace).toContain("studioVideoSettings(videoDraft.mode,videoDraft.tier,videoAssets,videoDraft.seed,nativeModeSpec,!!videoDraft.keepPrompt&&nativeVideo.supportsPromptOptimization)");
});

// Supplementary to the behaviour tests in canvas-bridge/video.test.ts: the vendored node panel (not routed in Studio
// today) hands the bridge the node's saved choice and a way to ask, so it cannot fall back to the vendor rewrite.
test("the node panel passes the saved text choice and the frame question to the shared bridge", () => {
  const page = read("canvas/pages/canvas/project.tsx");
  expect(page).toContain("keepPrompt:studioVideoKeepPrompt(node),");
  expect(page).toMatch(/confirmFrames:\(intent,model\)=>confirmStudioFrames\(modal,intent,model,/);
});
