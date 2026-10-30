import { expect, test } from "vitest";
import { chineseNumber, missingFigures, scriptMissing, scriptPlaceholders } from "./scene-script-check";

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
