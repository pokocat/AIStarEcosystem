import { expect, test } from "vitest";
import { studioScriptSuggestions } from "./studio-script-suggestions";

test("rejects only invalid suggestions and caps count without cutting instructions", () => {
  const first = { label: "换个开场", instruction: "先拍商品细节。" };
  const values = [null, 1, {}, { label: "很长的按钮文字超出限制", instruction: "调整开头" },
    { label: "长指令", instruction: "字".repeat(81) }, { label: "多\n行", instruction: "修改" },
    first, { ...first, instruction: "重复按钮" }, { label: "重复指令", instruction: first.instruction },
    { label: "😀".repeat(8), instruction: "字".repeat(80) },
    { label: "  调整结尾  ", instruction: "  结尾回到商品。  " }, { label: "第四条", instruction: "不应显示" }];
  expect(studioScriptSuggestions(values)).toEqual([first, { label: "😀".repeat(8), instruction: "字".repeat(80) }, { label: "调整结尾", instruction: "结尾回到商品。" }]);
  for (const value of [null, undefined, {}, "文本"]) expect(studioScriptSuggestions(value)).toEqual([]);
});
