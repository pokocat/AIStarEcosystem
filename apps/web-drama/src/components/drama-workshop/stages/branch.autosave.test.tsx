import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

// WB3：互动编排改一次之后不能一直自动保存；WB4：AI 起草的确认框要带上真实单价，读不到单价就不让点。
// 断行为（保存几次 / 确认框收到的 cost / 请求发没发），不断言可视文案（§8.0.1 ⑩）。

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/components/interactive/branch-canvas", () => ({ BranchCanvas: () => null }));
vi.mock("@/components/interactive/episode-editor", () => ({ EpisodeEditor: () => null }));
vi.mock("@/components/interactive/playthrough-dialog", () => ({ PlaythroughDialog: () => null }));
vi.mock("@/components/interactive/export-dialog", () => ({ ExportDialog: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const confirmCalls: Array<{ cost?: number }> = [];
vi.mock("@/components/drama-ui/confirm-dialog", () => ({
  dramaConfirm: async (opts: { cost?: number }) => {
    confirmCalls.push(opts);
    return true;
  },
}));

const interactiveDraft = vi.fn();
vi.mock("@/api", () => ({
  ProjectsApi: { interactiveDraft: (id: string, theme?: string) => interactiveDraft(id, theme) },
}));

let prices: Record<string, unknown> = {};
vi.mock("@/lib/use-drama-config", () => ({
  useDramaConfig: () => ({ confirmThreshold: 10, prices }),
}));

import { BranchStage } from "./branch";
import { defaultOverlay } from "@/lib/interactive-graph";
import type { ProjectData } from "@/mocks/drama-workshop";
import type { StageContext } from "./stage-context";

const BASE: ProjectData = {
  projectInfo: { title: "T", type: "悬疑", episodes: 2, duration: "每集 60 秒", ratio: "9:16", logline: "", mainline: "" },
  topicCards: [],
  episodes: [
    { no: 1, content: "E1" },
    { no: 2, content: "E2" },
  ],
  characters: [],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
};
const DOC: ProjectData = { ...BASE, interactive: defaultOverlay(BASE) };

/**
 * 外壳：保存后 setData → 重渲染，而且 ctx 每次渲染都是新对象 —— 就是改之前工作台页面的样子，
 * 保存函数只要依赖 ctx 的身份就会一直重排。
 */
function Harness({ onSave }: { onSave: (d: ProjectData) => void }) {
  const [data, setData] = React.useState(DOC);
  const ref = React.useRef(data);
  const ctx: StageContext = {
    projectId: "p1",
    saveData: async (next) => {
      ref.current = next;
      setData(next);
      onSave(next);
    },
    patchData: async (patch) => {
      const next = patch(ref.current);
      ref.current = next;
      setData(next);
      onSave(next);
    },
  };
  return <BranchStage state={{} as never} dispatch={() => {}} data={data} ctx={ctx} />;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  confirmCalls.length = 0;
  interactiveDraft.mockReset();
  prices = { interactiveDraft: 18 };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("互动编排自动保存（WB3）", () => {
  it("进来不改：一次都不存", async () => {
    const saves: ProjectData[] = [];
    render(<Harness onSave={(d) => saves.push(d)} />);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(saves).toHaveLength(0);
  });

  it("改一次只存一次，之后不再自己存", async () => {
    const saves: ProjectData[] = [];
    render(<Harness onSave={(d) => saves.push(d)} />);
    fireEvent.click(screen.getByTestId("branch-add-episode"));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(saves).toHaveLength(1);
    expect(saves[0].episodes).toHaveLength(3);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(saves).toHaveLength(1);
  });

  it("没到时间就离开：卸载时把这次改动存掉", async () => {
    const saves: ProjectData[] = [];
    const { unmount } = render(<Harness onSave={(d) => saves.push(d)} />);
    fireEvent.click(screen.getByTestId("branch-add-episode"));
    unmount();
    expect(saves).toHaveLength(1);
    expect(saves[0].episodes).toHaveLength(3);
  });
});

describe("互动剧 AI 起草的单价（WB4）", () => {
  it("确认框收到的是配置里的起草单价", async () => {
    interactiveDraft.mockResolvedValue({ episodes: BASE.episodes, interactive: defaultOverlay(BASE) });
    prices = { interactiveDraft: 23 };
    render(<Harness onSave={() => {}} />);
    await act(async () => {
      fireEvent.click(screen.getByTestId("branch-ai-draft"));
    });
    expect(confirmCalls.map((c) => c.cost)).toEqual([23]);
    expect(interactiveDraft).toHaveBeenCalledTimes(1);
  });

  it("配置里没有起草单价：按钮不可点，也不会发请求", async () => {
    prices = {};
    render(<Harness onSave={() => {}} />);
    const btn = screen.getByTestId("branch-ai-draft") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(confirmCalls).toHaveLength(0);
    expect(interactiveDraft).not.toHaveBeenCalled();
  });
});
