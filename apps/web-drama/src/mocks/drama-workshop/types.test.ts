import { describe, expect, it } from "vitest";
import { episodeContent } from "./types";

// 老数据按三段（钩子 / 梗概 / 看点）拼本集剧情：段尾自带句末标点时不能再补一个句号（评审 copy-14）。
describe("episodeContent 拼接旧三段", () => {
  it("段尾已有句号 / 感叹号时不再补，没有的才补", () => {
    const out = episodeContent({ hook: "她看见对面有人倒下", synopsis: "报警后现场干净如初。", beat: "反转：死者复活！" });
    expect(out).not.toMatch(/[。！？][。！？]/u);
    expect(out).toBe("她看见对面有人倒下。报警后现场干净如初。反转：死者复活！");
  });

  it("有新 content 就用 content，不拼旧三段", () => {
    expect(episodeContent({ content: " 新剧情 ", hook: "旧钩子" })).toBe("新剧情");
  });
});
