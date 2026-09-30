import { afterEach, describe, expect, it, vi } from "vitest";
import type { SegmentRef } from "@/canvas/core";
import {
  FILLER_ATTR,
  REF_ATTR,
  atQueryBefore,
  getSelectionOffsets,
  insertRefText,
  joinTokens,
  needsNormalize,
  removeRefAt,
  renderEditor,
  serializeEditor,
  setCaretOffset,
  snapOutOfRefs,
  spliceText,
  tokenizeSegment,
  type ChipView,
} from "./segment-text";

// 片段文本编辑器的底层：纯文本操作 + 编辑框 DOM 的往返。只断结构与文本，不断界面文案（§8.0.1 ⑩）。

const LOOK = "@[林微·成年](look:lk_ab12)";
const SCENE = "@[旧教室](scene:sc_9)";
const MAT = "@[旧车票](material:mt_x-1)";

const view = (ref: SegmentRef): ChipView => ({ label: ref.label, missing: ref.id === "gone", image: ref.kind === "look" ? { key: "k1", url: "data:image/png;base64,AA==" } : undefined });

function editor(text: string): HTMLDivElement {
  const el = document.createElement("div");
  el.setAttribute("contenteditable", "true");
  document.body.appendChild(el);
  renderEditor(el, text, view);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tokenizeSegment / joinTokens", () => {
  it("拆成文字和引用两种段，拼回去一个字不差", () => {
    const text = `（4 秒）日，${SCENE}。近景，${LOOK} 蹲在地上。\n（3 秒）特写，${LOOK} 拉开抽屉，摸到 ${MAT}。`;
    const tokens = tokenizeSegment(text);
    expect(tokens.filter((t) => t.type === "ref").map((t) => (t.type === "ref" ? `${t.ref.kind}:${t.ref.id}` : ""))).toEqual([
      "scene:sc_9",
      "look:lk_ab12",
      "look:lk_ab12",
      "material:mt_x-1",
    ]);
    expect(joinTokens(tokens)).toBe(text);
  });

  it("不合法的标记（种类不对 / 空名字 / id 带别的字符）是普通文字", () => {
    const text = "@[某人](person:p1) @[](look:lk_1) @[林微](look:lk 1) @[a](scene:)";
    const tokens = tokenizeSegment(text);
    expect(tokens).toEqual([{ type: "text", text }]);
  });

  it("空文本没有段", () => {
    expect(tokenizeSegment("")).toEqual([]);
  });
});

describe("纯文本编辑", () => {
  it("spliceText 替换一段并给出光标", () => {
    expect(spliceText("abcdef", 2, 4, "XY")).toEqual({ text: "abXYef", caret: 4 });
    expect(spliceText("abc", 5, 1, "!")).toEqual({ text: "a!", caret: 2 }); // 越界、反向都夹住
  });

  it("insertRefText：在光标处插入 @[名字](look:id)；落在别的标记中间时挪到标记外面", () => {
    const base = `你好${LOOK}再见`;
    const r = insertRefText(base, 2, 2, { kind: "scene", id: "sc_9", label: "旧教室" });
    expect(r.text).toBe(`你好${SCENE}${LOOK}再见`);
    expect(r.caret).toBe(2 + SCENE.length);
    const inside = insertRefText(base, 5, 5, { kind: "scene", id: "sc_9", label: "旧教室" });
    expect(inside.text).toBe(`你好${LOOK}${SCENE}再见`);
    expect(snapOutOfRefs(base, 5)).toBe(2 + LOOK.length);
    expect(snapOutOfRefs(base, 5, "start")).toBe(2);
  });

  it("insertRefText：名字里的 ] 和换行被清掉，拼出来的标记仍然解析得出来", () => {
    const r = insertRefText("", 0, 0, { kind: "look", id: "lk_1", label: "林]微\n" });
    expect(tokenizeSegment(r.text)).toMatchObject([{ type: "ref", ref: { kind: "look", id: "lk_1", label: "林 微" } }]);
  });

  it("removeRefAt：退格删光标前面那一整个标签，删除键删后面那个；旁边不是标签时不管", () => {
    const text = `甲${LOOK}乙`;
    expect(removeRefAt(text, 1 + LOOK.length, "backward")).toEqual({ text: "甲乙", caret: 1 });
    expect(removeRefAt(text, 1, "forward")).toEqual({ text: "甲乙", caret: 1 });
    expect(removeRefAt(text, 1, "backward")).toBeNull();
    expect(removeRefAt(text, text.length, "backward")).toBeNull();
  });

  it("atQueryBefore：@ 后面跟着的查找词；空白、括号、已经成形的标记都不算", () => {
    expect(atQueryBefore("近景，@", 4)).toEqual({ start: 3, query: "" });
    expect(atQueryBefore("近景，@林", 5)).toEqual({ start: 3, query: "林" });
    expect(atQueryBefore("近景，＠林微", 6)).toEqual({ start: 3, query: "林微" });
    expect(atQueryBefore("近景，@林 微", 7)).toBeNull();
    expect(atQueryBefore(`近景，${LOOK}`, 3 + LOOK.length)).toBeNull();
    expect(atQueryBefore("没有", 2)).toBeNull();
    expect(atQueryBefore(`@${"字".repeat(21)}`, 22)).toBeNull();
  });
});

describe("编辑框 DOM 往返（renderEditor ⇄ serializeEditor）", () => {
  const cases: [string, string][] = [
    ["空", ""],
    ["纯文字", "（4 秒）夜，车厢里。"],
    ["中文名 + 多个引用", `（4 秒）${SCENE}，${LOOK} 和 @[周岳](look:lk_ex_zhouyue) 对视。${MAT}`],
    ["换行、连续换行、结尾换行", `（4 秒）第一镜\n\n（3 秒）${LOOK} 第二镜\n`],
    ["引用挨着引用、在行首行尾", `${LOOK}${SCENE}\n${MAT}`],
    ["非法标记原样保留", "@[某人](person:p1) 和 @[](look:x) 和 @[林微](look:lk 1)"],
    ["被删掉的造型", "@[老吴](look:gone) 愣住"],
  ];
  for (const [name, text] of cases) {
    it(name, () => {
      const el = editor(text);
      expect(serializeEditor(el)).toBe(text);
      expect(needsNormalize(el)).toBe(false);
    });
  }

  it("标签是不可编辑的整块，存着原始标记；找不到的标红", () => {
    const el = editor(`${LOOK} @[老吴](look:gone)`);
    const chips = el.querySelectorAll(`[${REF_ATTR}]`);
    expect(chips).toHaveLength(2);
    expect(chips[0].getAttribute("contenteditable")).toBe("false");
    expect(chips[0].getAttribute(REF_ATTR)).toBe(LOOK);
    expect(chips[0].querySelector("img")).not.toBeNull();
    expect(chips[1].classList.contains("cve-chip-missing")).toBe(true);
  });

  it("结尾是换行时补一个不计入文本的占位 <br>", () => {
    const el = editor("一行\n");
    const last = el.lastChild as HTMLElement;
    expect(last.tagName).toBe("BR");
    expect(last.hasAttribute(FILLER_ATTR)).toBe(true);
    expect(serializeEditor(el)).toBe("一行\n");
  });

  it("浏览器塞进来的 <div> / <br> 也读得对，并判定要重画", () => {
    const el = document.createElement("div");
    el.innerHTML = `第一行<div>第二行</div><div><br></div><div>第四行<br></div>`;
    expect(serializeEditor(el)).toBe("第一行\n第二行\n\n第四行");
    expect(needsNormalize(el)).toBe(true);
    const el2 = document.createElement("div");
    el2.innerHTML = "甲<br>乙<br><br>";
    expect(serializeEditor(el2)).toBe("甲\n乙\n");
  });

  it("手打 / 粘贴出来的原始标记要重画成标签", () => {
    const el = editor("前面");
    el.appendChild(document.createTextNode(LOOK));
    expect(needsNormalize(el)).toBe(true);
    renderEditor(el, serializeEditor(el), view);
    expect(el.querySelectorAll(`[${REF_ATTR}]`)).toHaveLength(1);
    expect(needsNormalize(el)).toBe(false);
  });

  it("头像图加载失败时按 key 换新地址，换不到退回首字", async () => {
    const resign = vi.fn(async () => undefined);
    const el = document.createElement("div");
    renderEditor(el, LOOK, view, { resign });
    const img = el.querySelector("img")!;
    img.dispatchEvent(new Event("error"));
    await Promise.resolve();
    await Promise.resolve();
    expect(resign).toHaveBeenCalledWith("k1");
    expect(el.querySelector("img")).toBeNull();
    expect(el.querySelector(".cve-chip-av")?.textContent).toBe("林");
    expect(serializeEditor(el)).toBe(LOOK);
  });
});

describe("光标 ⇄ 文本位置", () => {
  it("文字、标签前后、换行后、末尾都能放回去再读出来", () => {
    const text = `甲${LOOK}乙\n丙${SCENE}\n`;
    const el = editor(text);
    el.focus();
    const offsets = [0, 1, 1 + LOOK.length, 2 + LOOK.length, 3 + LOOK.length, 4 + LOOK.length, 4 + LOOK.length + SCENE.length, text.length];
    for (const o of offsets) {
      setCaretOffset(el, o);
      expect(getSelectionOffsets(el)).toEqual({ start: o, end: o });
    }
  });

  it("落在标记中间的位置放到标签后面", () => {
    const el = editor(`甲${LOOK}乙`);
    setCaretOffset(el, 4);
    expect(getSelectionOffsets(el)?.start).toBe(1 + LOOK.length);
  });

  it("选区不在编辑框里时读不到", () => {
    const el = editor("甲乙");
    const other = document.createElement("p");
    other.textContent = "别处";
    document.body.appendChild(other);
    const r = document.createRange();
    r.setStart(other.firstChild!, 1);
    const sel = document.getSelection()!;
    sel.removeAllRanges();
    sel.addRange(r);
    expect(getSelectionOffsets(el)).toBeNull();
  });
});
