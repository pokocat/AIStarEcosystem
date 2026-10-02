import { describe, expect, it } from "vitest";
import { CANVAS_TRAIT_TABS } from "@/constants/canvas-traits";
import { applyTraits, applyTraitsLine, normalizeTraits, toggleTrait, traitCount, traitsLine } from "./traits";

// 角色设计写外貌描述：替换 / 追加 / 删除那一行，别的段落一个字不动。
// 断的是那一行的内容与其它行是否原样（这一行本身就是要写进提示词的产物，不是界面文案）。

const PROMPT = [
  "基本信息：中国男性，四十岁，身高一米七八，偏瘦。",
  "面部特征：方脸，眉毛浓。",
  "",
  "服饰装备：深蓝色公交制服外套。",
].join("\n");

describe("traitsLine", () => {
  it("按页签和组的顺序拼，带上各组的说法", () => {
    expect(traitsLine({ 年龄: ["23–28"], 性别表达: ["女性"], 肤色: ["白皙"], "区域 / 文化背景": ["东亚"] })).toBe(
      "角色设计：女性，23–28 岁，东亚，白皙肤色",
    );
  });

  it("单个标签自己的说法优先（60+ → 60 岁以上，无配饰 → 不戴配饰）", () => {
    expect(traitsLine({ 年龄: ["60+"], 配饰: ["无配饰"] })).toBe("角色设计：60 岁以上，不戴配饰");
  });

  it("自定义的肤色 / 发色原样套进组的说法", () => {
    expect(traitsLine({ 发色: ["挑染几缕蓝色"] })).toBe("角色设计：挑染几缕蓝色头发");
  });

  it("一个都没选返回 null", () => {
    expect(traitsLine({})).toBeNull();
    expect(traitsLine(undefined)).toBeNull();
    expect(traitsLine({ 年龄: [] })).toBeNull();
  });
});

describe("applyTraitsLine", () => {
  it("没有这一行：追加在末尾，前面的段落原样保留", () => {
    const out = applyTraitsLine(PROMPT, "角色设计：男性，36–45 岁");
    expect(out).toBe(`${PROMPT}\n角色设计：男性，36–45 岁`);
    expect(out.startsWith(PROMPT)).toBe(true);
  });

  it("原文以换行结尾：直接接在后面，不多加空行", () => {
    expect(applyTraitsLine("基本信息：女。\n", "角色设计：女性")).toBe("基本信息：女。\n角色设计：女性");
  });

  it("描述是空的：就只有这一行", () => {
    expect(applyTraitsLine("", "角色设计：女性")).toBe("角色设计：女性");
    expect(applyTraitsLine("  ", "角色设计：女性")).toBe("角色设计：女性");
  });

  it("已经有这一行（在中间）：原地替换，上下的段落一个字不动", () => {
    const lines = PROMPT.split("\n");
    const withLine = [lines[0], "角色设计：女性，18–22 岁", ...lines.slice(1)].join("\n");
    const out = applyTraitsLine(withLine, "角色设计：男性");
    expect(out).toBe([lines[0], "角色设计：男性", ...lines.slice(1)].join("\n"));
  });

  it("有好几行「角色设计：」：只留第一处（换成新的），多的删掉", () => {
    const src = "甲\n角色设计：旧 1\n乙\n  角色设计：旧 2\n丙";
    expect(applyTraitsLine(src, "角色设计：新")).toBe("甲\n角色设计：新\n乙\n丙");
  });

  it("全都清掉（line=null）：删掉这一行，别的不动；本来就没有时原样返回", () => {
    expect(applyTraitsLine(`${PROMPT}\n角色设计：女性`, null)).toBe(PROMPT);
    expect(applyTraitsLine(PROMPT, null)).toBe(PROMPT);
  });

  it("用户自己写的、只是提到「角色设计」的句子不算那一行", () => {
    const src = "姿态构图：按角色设计：正面站立";
    expect(applyTraitsLine(src, "角色设计：女性")).toBe(`${src}\n角色设计：女性`);
  });

  it("替换两次和替换一次结果一样（幂等）", () => {
    const once = applyTraitsLine(PROMPT, "角色设计：女性");
    expect(applyTraitsLine(once, "角色设计：女性")).toBe(once);
  });
});

describe("normalizeTraits / toggleTrait / applyTraits", () => {
  it("旧写法（key 是页签名）按标签找回所属的组；认不得的丢掉", () => {
    expect(normalizeTraits({ 基础: ["男性", "36–45"], 风格: ["平静正视", "白底定妆"], 乱写: ["x"] })).toEqual({
      性别表达: ["男性"],
      年龄: ["36–45"],
      表情状态: ["平静正视"],
      摄影方案: ["白底定妆"],
    });
  });

  it("旧写法里页签下认不得的值归到这个页签允许自定义的那一组", () => {
    expect(normalizeTraits({ 基础: ["偏暖的象牙白"] })).toEqual({ 肤色: ["偏暖的象牙白"] });
  });

  it("单选组点另一个就换掉，再点一次取消；多选组累加", () => {
    let t = toggleTrait({}, "性别表达", "女性");
    t = toggleTrait(t, "性别表达", "男性");
    expect(t).toEqual({ 性别表达: ["男性"] });
    t = toggleTrait(t, "性别表达", "男性");
    expect(t).toEqual({});
    t = toggleTrait(toggleTrait({}, "配饰", "小银耳饰"), "配饰", "细框眼镜");
    expect(t).toEqual({ 配饰: ["小银耳饰", "细框眼镜"] });
  });

  it("applyTraits：一次给出新的 traits 和新的外貌描述", () => {
    const r = applyTraits({ prompt: PROMPT }, { 基础: ["男性"] });
    expect(r.traits).toEqual({ 性别表达: ["男性"] });
    expect(r.prompt).toBe(`${PROMPT}\n角色设计：男性`);
    expect(traitCount(r.traits)).toBe(1);
  });

  it("组名全表唯一（它是 traits 的 key）", () => {
    const names = CANVAS_TRAIT_TABS.flatMap((t) => t.groups.map((g) => g.name));
    expect(new Set(names).size).toBe(names.length);
    expect(CANVAS_TRAIT_TABS.map((t) => t.name)).toEqual(["基础", "妆容与穿搭", "五官", "体型", "发型", "风格"]);
  });
});
