import { describe, expect, it } from "vitest";
import { cleanRefLabel, formatRef, parseRefs, parseShots, REF_PATTERN, stripRefs, totalDuration } from "./refs";

// 片段文本里的 @ 引用与镜头时长。只断结构（kind / id / 位置 / 秒数），不断界面文案（§8.0.1 ⑩）。

describe("parseRefs", () => {
  it("解析出 kind / id / 显示名 / 位置", () => {
    const text = "（4 秒）日，@[旧教室](scene:sc_1)。@[林微·成年](look:lk_ab12) 蹲下。";
    const refs = parseRefs(text);
    expect(refs.map((r) => [r.kind, r.id, r.label])).toEqual([
      ["scene", "sc_1", "旧教室"],
      ["look", "lk_ab12", "林微·成年"],
    ]);
    for (const r of refs) expect(text.slice(r.start, r.end)).toMatch(/^@\[.+\]\((look|scene|material):[A-Za-z0-9_-]+\)$/);
  });

  it("非法 id / 未知 kind / 显示名带换行的都不算引用", () => {
    expect(parseRefs("@[甲](look:bad id)")).toEqual([]);
    expect(parseRefs("@[甲](look:坏)")).toEqual([]);
    expect(parseRefs("@[甲](prop:p1)")).toEqual([]);
    expect(parseRefs("@[甲\n乙](look:lk_1)")).toEqual([]);
    expect(parseRefs(`@[甲](look:${"a".repeat(65)})`)).toEqual([]);
  });

  it("连着调两次结果一样（全局正则不串 lastIndex）", () => {
    const t = "@[甲](look:lk_1) @[乙](material:mt_2)";
    expect(parseRefs(t)).toEqual(parseRefs(t));
    expect(REF_PATTERN.lastIndex).toBe(0);
  });
});

describe("formatRef / stripRefs", () => {
  it("序列化后能原样解析回来（往返）", () => {
    const s = `开头 ${formatRef("look", "lk_1", "林微·学生时期")} 中间 ${formatRef("material", "mt-9", "旧车票")}`;
    const refs = parseRefs(s);
    expect(refs.map((r) => [r.kind, r.id, r.label])).toEqual([
      ["look", "lk_1", "林微·学生时期"],
      ["material", "mt-9", "旧车票"],
    ]);
  });

  it("显示名里的 ] 和换行会被清掉、超长截到 40 字，照样能解析", () => {
    const s = formatRef("scene", "sc_1", `a]b\nc${"长".repeat(60)}`);
    const [r] = parseRefs(s);
    expect(r.id).toBe("sc_1");
    expect(Array.from(r.label).length).toBeLessThanOrEqual(40);
    expect(r.label).not.toMatch(/[\]\n]/);
    expect(cleanRefLabel("   ")).not.toBe("");
  });

  it("id 不合法时拼不成标记，退回普通文字（不会留下解析不出来的半截标记）", () => {
    const s = formatRef("look", "bad id!", "林微");
    expect(parseRefs(s)).toEqual([]);
    expect(s).not.toMatch(/\]\(/);
  });

  it("stripRefs 把标记换成显示名", () => {
    expect(stripRefs("（3 秒）@[林微](look:lk_1) 拉开抽屉")).toBe("（3 秒）林微 拉开抽屉");
    expect(stripRefs("")).toBe("");
  });
});

describe("parseShots / totalDuration", () => {
  it("逐行起镜头；没写时长的行并进上一镜", () => {
    const shots = parseShots("（4 秒）日，旧教室。\n她蹲在地上。\n\n（3 秒）特写，抽屉。");
    expect(shots).toEqual([
      { durationSec: 4, text: "日，旧教室。\n她蹲在地上。" },
      { durationSec: 3, text: "特写，抽屉。" },
    ]);
  });

  it("认半角括号、没空格、小数、s 单位；第一行没写时长单独成一镜", () => {
    const shots = parseShots("开场白\n(2秒)甲\n（1.5 秒）乙\n(3s) 丙");
    expect(shots.map((s) => s.durationSec)).toEqual([null, 2, 1.5, 3]);
    expect(shots[0].text).toBe("开场白");
  });

  it("totalDuration：各镜时长之和（没写的按 0），取整到秒", () => {
    expect(totalDuration("（4 秒）甲\n（3 秒）乙\n丙")).toBe(7);
    expect(totalDuration("（1.5 秒）甲\n（1.5 秒）乙")).toBe(3);
    expect(totalDuration("没有时长")).toBe(0);
    expect(totalDuration("")).toBe(0);
  });
});
