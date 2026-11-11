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

test('复刻方式随草稿与任务链接保留，切回分镜复刻或其他场景时清除', () => {
  window.history.replaceState(null, '', '/video?scene=recreation&tool=depth');
  writeSceneQuery('/video', 'recreation', 'p'); expect(window.location.search).toContain('tool=depth');
  writeSceneQuery('/video', 'recreation', 'p', 'task', 'replacement'); expect(window.location.search).toContain('tool=replacement');
  writeSceneQuery('/video', 'recreation', 'p', undefined, 'recreation'); expect(window.location.search).not.toContain('tool=');
  writeSceneQuery('/video', 'ecom-talking'); expect(window.location.search).not.toContain('tool=');
});
