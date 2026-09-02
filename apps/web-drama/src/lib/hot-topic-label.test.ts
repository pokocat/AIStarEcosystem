import { describe, expect, it } from "vitest";
import { hotTopicLabel } from "./hot-topic-label";

describe("hotTopicLabel", () => {
  it("取第一个分句", () => {
    expect(hotTopicLabel("替身归来，霸总看着AI生成的我泪流满面")).toBe("替身归来");
    expect(hotTopicLabel("全网黑后，我靠玄学直播打脸营销号")).toBe("全网黑后");
  });

  it("没有分句符时按长度截断", () => {
    expect(hotTopicLabel("带球跑五年萌宝带着黑科技爹地杀回来了")).toBe("带球跑五年萌宝带着黑科技…");
  });

  it("首个分句本身超长也截断", () => {
    expect(hotTopicLabel("误入豪门我发现老公竟是多年前的救命恩人，她当场愣住")).toBe("误入豪门我发现老公竟是多…");
  });

  it("已经很短的标签原样保留", () => {
    expect(hotTopicLabel("真千金回来了")).toBe("真千金回来了");
  });

  it("空值与空白安全", () => {
    expect(hotTopicLabel("")).toBe("");
    expect(hotTopicLabel("   ")).toBe("");
    expect(hotTopicLabel(undefined as unknown as string)).toBe("");
  });

  it("max 可调", () => {
    expect(hotTopicLabel("这是一个很长的标签没有任何分句符号", 6)).toBe("这是一个很长…");
  });
});
