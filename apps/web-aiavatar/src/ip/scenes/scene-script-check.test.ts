import { expect, test } from "vitest";
import { chineseNumber, classifyBlanks, missingFigures, scriptMissing, scriptPlaceholders, splitBlanks, overlongShots } from "./scene-script-check";

test("the director's 还缺 line is split off from the script", () => {
  expect(scriptMissing("还缺：团购价、怎么买。\n第1镜（0–5 秒）：门头。")).toEqual({ missing: "团购价、怎么买", body: "第1镜（0–5 秒）：门头。" });
  expect(scriptMissing("第1镜（0–5 秒）：门头。")).toEqual({ body: "第1镜（0–5 秒）：门头。" });
  // 真模型写在最后一行，后面还跟了一句解释。
  expect(scriptMissing("第1镜（0–5 秒）：门头。\n\n还缺：团购价、怎么买。正文中已按规范以【待补：……】标注。"))
    .toEqual({ missing: "团购价、怎么买", body: "第1镜（0–5 秒）：门头。" });
});

test("unfilled 【待补】 placeholders are listed", () => {
  expect(scriptPlaceholders("团购价【待补：团购价】，点【待补：购买入口】下单")).toEqual(["团购价", "购买入口"]);
  expect(scriptPlaceholders("双人餐九十九")).toEqual([]);
});

test("chinese numerals read the way scripts write prices", () => {
  expect([chineseNumber("九十九"), chineseNumber("一百五十八"), chineseNumber("一百零八"), chineseNumber("两千"), chineseNumber("三点五"), chineseNumber("十二")])
    .toEqual([99, 158, 108, 2000, 3.5, 12]);
  expect(chineseNumber("一万二千")).toBe(12000);
});

test("figures the user gave but the script left out are reported, whether the script writes digits or chinese numerals", () => {
  const given = ["巷里火锅，双人套餐 99，原价 158，2 人用，周末要预约"];
  expect(missingFigures(given, "双人餐九十九，原价一百五十八，两人吃")).toEqual([]);
  expect(missingFigures(given, "双人餐 99 元，两个人吃")).toEqual(["158"]);
  // 一位数且后面没有单位的不算（「第1镜」里的 1 也不会被要求出现在别处）。
  expect(missingFigures(["第 1 天想去"], "随便")).toEqual([]);
});

test("blanks for facts marked 有就写 are optional; anything else must be filled", () => {
  const facts = [{ label: "团购价", required: true }, { label: "怎么买", required: true }, { label: "原价", required: false }, { label: "使用限制", required: false }];
  expect(classifyBlanks(["团购价", "原价", "购买入口", "使用限制", "团购价"], facts)).toEqual({ required: ["团购价", "购买入口"], optional: ["原价", "使用限制"] });
});

test("blanks are split out for highlighting", () => {
  expect(splitBlanks("点【待补：入口】下单")).toEqual([{ text: "点", blank: false }, { text: "【待补：入口】", blank: true }, { text: "下单", blank: false }]);
});

test("shot numbers and timecodes do not count as the user's figures", () => {
  expect(missingFigures(["2 人用"], "第2镜（2–4 秒）：牛肉一份")).toEqual(["2"]);
  expect(missingFigures(["2 人用"], "第1镜（0–2 秒）：两人吃")).toEqual([]);
});

describe("overlongShots", () => {
  it("counts what is spoken in each shot against its length, whichever quotes the model used", () => {
    const script = [
      "第3镜（8–12 秒）：画面：调整表带；博主说：“甚至睡觉也可以佩戴，平时出门戴它特别顺手。”",
      "第4镜（12–15 秒）这一镜的作用：下单",
      "博主说：「官方定价1999元，现在双十一只需要999元，点下面链接直接拍，冲！」",
      "六、全片保持与禁止：",
    ].join("\n");
    expect(overlongShots(script)).toEqual([{ no: 4, seconds: 3, chars: 30 }]);
  });
  it("leaves shots without lines and scripts without shots alone", () => {
    expect(overlongShots("第1镜（0–3 秒）：画面：只有商品。")).toEqual([]);
    expect(overlongShots("随便写的一段提示词")).toEqual([]);
  });
});

test("全角数字和长破折号也能认出镜头和价格（2026-11-09 线上 terra）", () => {
  expect(overlongShots("第１镜（０—２秒）\n博主说：「这一句台词很长很长很长很长很长很长」")).toEqual([{ no: 1, seconds: 2, chars: 17 }]);
  expect(missingFigures(["原价18元，现价9.9元"], "博主说：「原价１８，现在只要９.９」")).toEqual([]);
});
