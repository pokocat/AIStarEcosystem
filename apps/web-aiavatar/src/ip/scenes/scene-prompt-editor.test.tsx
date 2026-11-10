// @vitest-environment jsdom
// 2026-11-01 用户给了参考站的样子：提示词里的参考图显示成「缩略图 + 图N」的标签，点一下看大图；存下来的仍是原来的字。
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { Editor } from "@tiptap/core";
import { splitPromptRefs } from "./scene-prompt-refs";
import { PromptText, ScenePromptEditor, type ScenePromptRef } from "./scene-prompt-editor";
import { sceneScriptLayers } from "./scene-script-layers";

vi.mock("@/canvas-bridge/image-storage", () => ({ refreshImageUrl: vi.fn(async (key: string) => `/signed/${key}`) }));
beforeEach(() => { vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(fn, 0)); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const REFS: ScenePromptRef[] = [
  { index: 1, title: "马克杯", url: "https://cdn.test/cup.jpg", storageKey: "k/cup" },
  { index: 2, title: "出镜人物", url: "https://cdn.test/lin.jpg", storageKey: "k/lin" },
];

test("图N, @图N and 参考图N are references only within the pictures handed over; 图12 is not 图1", () => {
  expect(splitPromptRefs("拿起@图1，对比图2和参考图2", 2)).toEqual([
    { text: "拿起" }, { ref: 1, raw: "@图1" }, { text: "，对比" }, { ref: 2, raw: "图2" }, { text: "和参考" }, { ref: 2, raw: "图2" }]);
  expect(splitPromptRefs("图3 没交给模型，图12 也不是图1", 2)).toEqual([{ text: "图3 没交给模型，图12 也不是" }, { ref: 1, raw: "图1" }]);
  expect(splitPromptRefs("没有图", 0)).toEqual([{ text: "没有图" }]);
});

function Host({ initial, refs: start = REFS }: { initial: string; refs?: ScenePromptRef[] }) {
  const [value, setValue] = useState(initial);
  const [refs, setRefs] = useState(start);
  return <>
    <ScenePromptEditor ariaLabel="想做的视频" value={value} onChange={setValue} refs={refs} placeholder="写点什么"/>
    <output data-testid="value">{value}</output>
    <button type="button" onClick={() => setRefs(refs.slice(0, 1))}>只留图1</button>
  </>;
}
const editorOf = async () => (await screen.findByRole("textbox", { name: "想做的视频" }) as unknown as { editor: Editor }).editor;

test("the box shows each reference as a thumbnail chip and keeps the text exactly as written", async () => {
  render(<Host initial={"第1镜：她拿起@图1。\n第2镜：图2对着镜头说话。"}/>);
  const editor = await editorOf();
  const chips = await screen.findAllByRole("button", { name: /查看大图$/ });
  expect(chips.map(c => c.getAttribute("aria-label"))).toEqual(["图1：马克杯，查看大图", "图2：出镜人物，查看大图"]);
  expect(chips[0].querySelector("img")?.getAttribute("src")).toBe("https://cdn.test/cup.jpg");
  // 存下来的字一个都不变（「@图1」还是「@图1」）。
  expect(editor.getText({ blockSeparator: "\n" })).toBe("第1镜：她拿起@图1。\n第2镜：图2对着镜头说话。");
});

test("typing 图1 turns it into a chip; the saved value is still plain text", async () => {
  render(<Host initial="展示"/>);
  const editor = await editorOf();
  act(() => { editor.commands.focus("end"); editor.commands.insertContent("图1"); });
  await waitFor(() => expect(screen.getByRole("button", { name: "图1：马克杯，查看大图" })).toBeTruthy());
  expect(screen.getByTestId("value").textContent).toBe("展示图1");
  // 编号超出交给模型的图数：还是字。
  act(() => { editor.commands.insertContent("，图5"); });
  expect(screen.queryByRole("button", { name: /^图5/ })).toBeNull();
  expect(screen.getByTestId("value").textContent).toBe("展示图1，图5");
});

test("clicking a chip opens the picture large; removing that picture turns the chip back into text", async () => {
  render(<Host initial="图1 和 图2"/>);
  fireEvent.click(await screen.findByRole("button", { name: "图2：出镜人物，查看大图" }));
  await waitFor(() => expect(document.querySelector(".director-image-preview")).toBeTruthy());
  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.click(screen.getByRole("button", { name: "只留图1" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: /^图2/ })).toBeNull());
  expect(screen.getByRole("button", { name: "图1：马克杯，查看大图" })).toBeTruthy();
  expect(screen.getByTestId("value").textContent).toBe("图1 和 图2");
});

test("read-only text (the director's script card) shows the same chips", () => {
  render(<p><PromptText text="第1镜：拿起图1，转到侧面" refs={REFS}/></p>);
  expect(screen.getByRole("button", { name: "图1：马克杯，查看大图" })).toBeTruthy();
  cleanup();
  render(<p><PromptText text="第1镜：拿起图1" refs={[]}/></p>);
  expect(screen.queryByRole("button")).toBeNull();
  expect(screen.getByText("第1镜：拿起图1")).toBeTruthy();
});

test("typing @ lists the placed materials and picking one inserts its chip; the saved text is 图N", async () => {
  render(<Host initial="让"/>);
  const editor = await editorOf();
  act(() => { editor.commands.focus("end", { scrollIntoView: false }); editor.commands.insertContent("@"); });
  const menu = await screen.findByRole("listbox", { name: "选择素材" });
  expect(within(menu).getAllByRole("option").map(o => o.textContent)).toEqual([expect.stringContaining("图1"), expect.stringContaining("图2")]);
  fireEvent.click(within(menu).getByRole("option", { name: /图2/ }));
  await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  expect(screen.getByRole("button", { name: "图2：出镜人物，查看大图" })).toBeTruthy();
  expect(screen.getByTestId("value").textContent).toBe("让图2 ");
});

test("the @ menu narrows as you type, and with nothing placed it says how to get materials", async () => {
  const { unmount } = render(<Host initial=""/>);
  const editor = await editorOf();
  act(() => { editor.commands.focus("end", { scrollIntoView: false }); editor.commands.insertContent("@马克"); });
  const menu = await screen.findByRole("listbox", { name: "选择素材" });
  expect(within(menu).getAllByRole("option")).toHaveLength(1);
  unmount();
  render(<Host initial="" refs={[]}/>);
  const empty = await editorOf();
  act(() => { empty.commands.focus("end", { scrollIntoView: false }); empty.commands.insertContent("@"); });
  expect((await screen.findByRole("listbox", { name: "选择素材" })).textContent).toContain("添加素材");
});

// 2026-11-10 分层：编导的六段脚本里不发给视频模型的内容灰字显示，剧情概述那行末尾标「仅参考」；改字后标注跟着变，存下来的字不变。
function LayeredHost({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return <>
    <ScenePromptEditor ariaLabel="视频脚本" value={value} onChange={setValue} refs={REFS} hidden={sceneScriptLayers(value)?.hidden}/>
    <output data-testid="value">{value}</output>
  </>;
}
test("parts that are not sent to the video model are greyed out, and the summary is tagged 仅参考", async () => {
  const script = "一、剧情概述：宝妈试用卸妆膏。\n五、镜头时间轴：\n第1镜（0–4 秒）这一镜的作用：截停\n宝妈（图2）说：「三秒卸干净。」";
  render(<LayeredHost initial={script}/>);
  const box = await screen.findByRole("textbox", { name: "视频脚本" });
  await waitFor(() => expect(box.querySelectorAll(".scene-prompt-reference-only")).toHaveLength(2));
  expect([...box.querySelectorAll(".scene-prompt-reference-only")].map(e => e.textContent)).toEqual(["一、剧情概述：宝妈试用卸妆膏。", "这一镜的作用：截停"]);
  expect(box.querySelectorAll(".scene-prompt-reference-tag")).toHaveLength(1);
  expect(screen.getByTestId("value").textContent).toBe(script);
  // 删掉剧情概述，标签也跟着没了。
  const editor = (box as unknown as { editor: Editor }).editor;
  act(() => { editor.commands.setContent({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "五、镜头时间轴：" }] },
    { type: "paragraph", content: [{ type: "text", text: "第1镜（0–4 秒）这一镜的作用：截停" }] }] }); });
  await waitFor(() => expect(box.querySelectorAll(".scene-prompt-reference-tag")).toHaveLength(0));
});
