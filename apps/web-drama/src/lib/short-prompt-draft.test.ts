import { describe, expect, it } from "vitest";
import { cutPromptTail } from "./short-prompt-draft";

/**
 * 分卷切割（v0.146）：命中 40 镜上限后，按「拆到哪」的时间码在用户原文里切一刀。
 * 铁律：不静默漏掉用户写的内容；拿不准就返回 null，由 UI 提示手动复制。
 * 用例覆盖 Codex 评审提出的两个失败场景（长段中间切断、多章时间轴重置）。
 */
describe("cutPromptTail", () => {
  const prompt = [
    "【角色】阿宁：齐耳短发",
    "00:00-04:19 远景：阿宁进门",
    "04:19-06:08 中景：她把表放上吧台",
    "06:08-07:40 特写：老周抬头",
    "07:40-08:10 收尾：两人并肩走出",
  ].join("\n");

  it("切在下一个时间码那一行，不重复上一条已拆过的镜头", () => {
    const tail = cutPromptTail(prompt, "04:19-06:08");
    expect(tail).toBe(["06:08-07:40 特写：老周抬头", "07:40-08:10 收尾：两人并肩走出"].join("\n"));
    expect(tail).not.toContain("她把表放上吧台");
  });

  it("上限切在长段中间时把那一行整行留下，不跳过没拆完的动作", () => {
    // 10:00-10:30 是一个长段，被拆成多镜共用同一时间码：第 40 镜是动作 A，第 41 镜是 B/C。
    const p = [
      "09:30-10:00 中景：铺垫",
      "10:00-10:30 动作 A、动作 B、动作 C",
      "10:30-10:35 收尾",
    ].join("\n");
    const tail = cutPromptTail(p, "10:00-10:30", true);
    expect(tail).toContain("动作 B"); // 关键：B、C 不能丢
    expect(tail?.startsWith("10:00-10:30")).toBe(true);
  });

  it("同一时间码在多章里重复出现时返回 null，绝不切回已拆过的章节", () => {
    const p = [
      "第一章",
      "00:10-00:20 A1",
      "00:20-00:30 A2",
      "第二章（时间轴重新计时）",
      "00:10-00:20 B1",
      "00:20-00:30 B2",
    ].join("\n");
    expect(cutPromptTail(p, "00:10-00:20")).toBeNull();
  });

  it("定位不到就返回 null，不猜也不静默返回原文", () => {
    expect(cutPromptTail(prompt, "99:99-99:99")).toBeNull();
    expect(cutPromptTail(prompt, "")).toBeNull();
    expect(cutPromptTail(prompt, undefined)).toBeNull();
    expect(cutPromptTail("", "04:19-06:08")).toBeNull();
  });

  it("锚点在最后一行且后面没有新时间码时，把该行留给下一条", () => {
    const p = ["00:00-00:12 中景：开场", "00:12-12:00 长镜：独白"].join("\n");
    expect(cutPromptTail(p, "00:12-12:00")).toBe("00:12-12:00 长镜：独白");
  });

  it("锚点就在开头（等于没切）算定位失败", () => {
    expect(cutPromptTail("00:00-04:19 只有一行", "00:00-04:19")).toBeNull();
  });
});
