import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { EpisodeEditor } from "./episode-editor";
import { buildCondition } from "@/lib/interactive-graph";
import type { FlagValue, InteractiveEpisode } from "@/lib/interactive-types";

// 断结构和回调（用了哪种输入框、改完上抛的整集长什么样），不断言可视文案（§8.0.1 ⑩）。

const episode = (condition: string | undefined, setFlags?: Record<string, FlagValue>): InteractiveEpisode => ({
  episodeId: "ep1",
  no: 1,
  title: "门厅",
  durationSec: 30,
  videoUrl: null,
  isEnding: false,
  nextVideoId: null,
  interactions: [
    {
      id: "i1",
      triggerTime: 10,
      interactionType: "choice",
      condition,
      uiConfig: { question: "开门？", options: [{ id: "A", text: "开", nextVideoId: null, setFlags }] },
    },
  ],
});

function renderEditor(ep: InteractiveEpisode, flags: Record<string, FlagValue>) {
  const onChange = vi.fn();
  const r = render(
    <EpisodeEditor
      episode={ep}
      allEpisodes={[ep]}
      flags={flags}
      isStart
      onChange={onChange}
      onSetStart={() => {}}
      onDelete={() => {}}
      onDuplicate={() => {}}
      onProduce={() => {}}
    />,
  );
  return { ...r, onChange };
}

afterEach(cleanup);

describe("EpisodeEditor · 剧情状态改了类型（WB6）", () => {
  it("「是否」改成「数字」后，选项里的旧值给数字框（标成要重填），不再只能选是 / 否", () => {
    const { container } = renderEditor(episode(undefined, { 分数: true }), { 分数: 0 });
    const input = container.querySelector('input[type="number"][aria-invalid="true"]') as HTMLInputElement | null;
    expect(input).not.toBeNull();
    expect(input!.value).toBe("");
  });

  it("重填之后上抛的是数字", () => {
    const { container, onChange } = renderEditor(episode(undefined, { 分数: true }), { 分数: 0 });
    const input = container.querySelector('input[type="number"][aria-invalid="true"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "3" } });
    const next = onChange.mock.calls.at(-1)![0] as InteractiveEpisode;
    expect(next.interactions[0].uiConfig.options![0].setFlags).toEqual({ 分数: 3 });
  });

  it("弹出条件的值同样按现在的类型给输入框，改完比较方式和值都对得上", () => {
    const cond = buildCondition({ flag: "分数", op: "==", value: true });
    const { container, onChange } = renderEditor(episode(cond), { 分数: 0 });
    const input = container.querySelector('input[type="number"][aria-invalid="true"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: "5" } });
    const next = onChange.mock.calls.at(-1)![0] as InteractiveEpisode;
    expect(next.interactions[0].condition).toBe(buildCondition({ flag: "分数", op: "==", value: 5 }));
  });

  it("类型没变：不标红", () => {
    const { container } = renderEditor(episode(buildCondition({ flag: "分数", op: ">", value: 2 }), { 分数: 1 }), { 分数: 0 });
    expect(container.querySelector('[aria-invalid="true"]')).toBeNull();
  });
});

describe("EpisodeEditor · 条件用的剧情状态被删了（WB7）", () => {
  const cond = buildCondition({ flag: "钥匙", op: "==", value: true });

  it("一条剧情状态都没了：条件的下拉仍在，能选「不设条件」清掉", () => {
    const { container, onChange } = renderEditor(episode(cond), {});
    const flagSelect = container.querySelector('option[value="钥匙"]')?.closest("select") as HTMLSelectElement | null;
    expect(flagSelect).not.toBeNull();
    expect(flagSelect!.querySelector('option[value=""]')).not.toBeNull();
    fireEvent.change(flagSelect!, { target: { value: "" } });
    const next = onChange.mock.calls.at(-1)![0] as InteractiveEpisode;
    expect(next.interactions[0].condition).toBeUndefined();
  });

  it("还有别的状态时同样能清掉，而且旧条件的状态名仍显示在下拉里", () => {
    const { container, onChange } = renderEditor(episode(cond), { 好感度: 0 });
    const flagSelect = container.querySelector('option[value="钥匙"]')?.closest("select") as HTMLSelectElement;
    expect(flagSelect.value).toBe("钥匙");
    expect(flagSelect.querySelector('option[value="好感度"]')).not.toBeNull();
    fireEvent.change(flagSelect, { target: { value: "" } });
    expect((onChange.mock.calls.at(-1)![0] as InteractiveEpisode).interactions[0].condition).toBeUndefined();
  });
});
