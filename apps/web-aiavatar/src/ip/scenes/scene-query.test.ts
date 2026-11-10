// @vitest-environment jsdom
import { beforeEach, expect, test } from "vitest";
import { writeSceneQuery } from "./scene-query";

beforeEach(() => window.history.replaceState(null, "", "/video"));

test("补默认场景时不丢只带 task 的链接", () => {
  window.history.replaceState(null, "", "/video?task=PEX-1");
  writeSceneQuery("/video", "ecom-talking");
  expect(window.location.search).toBe("?scene=ecom-talking&task=PEX-1");
});
test("同一草稿保留任务，换草稿或离开草稿不带走任务", () => {
  window.history.replaceState(null, "", "/video?scene=a&draft=IPP-1&task=PEX-1");
  writeSceneQuery("/video", "a", "IPP-1");
  expect(window.location.search).toContain("task=PEX-1");
  writeSceneQuery("/video", "a", "IPP-2");
  expect(window.location.search).not.toContain("task=");
  window.history.replaceState(null, "", "/video?scene=a&draft=IPP-1&task=PEX-1");
  writeSceneQuery("/video", "a");
  expect(window.location.search).not.toContain("task=");
});
