import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// 复核（remount）：分集剧情生成中切去逐集制作再切回来，OutlineStage 是新实例。
// 之前的在途锁挂在实例上，新实例从空闲开始、又是空态，按钮能再点一次 → 第二次 outlineAiDraft、扣两份。
// 这里用**真的** CreditButton（带它自己的锁和 lockKey），只把确认框和配置换成立即返回。
// §8.0.1 ⑩：断请求次数与落库结果，不断言可视文案。

vi.mock("@/components/drama-ui/confirm-dialog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/drama-ui/confirm-dialog")>()),
  dramaConfirm: () => Promise.resolve(true),
}));
// 配置读取默认立即返回；个别用例换成手动放行（= 配置慢回来）
const getDramaConfig = vi.fn();
vi.mock("@/api/drama-config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/drama-config")>()),
  getDramaConfig: () => getDramaConfig(),
}));
vi.mock("@/lib/use-drama-config", async () => {
  const { DRAMA_CONFIG_DEFAULTS } = await vi.importActual<typeof import("@/api/drama-config")>("@/api/drama-config");
  return { useDramaConfig: () => DRAMA_CONFIG_DEFAULTS };
});
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: () => {} }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const outlineAiDraft = vi.fn();
vi.mock("@/api", () => ({
  ProjectsApi: { outlineAiDraft: (id: string, count: number) => outlineAiDraft(id, count) },
}));

import { OutlineStage } from "./outline";
import type { ProjectData } from "@/mocks/drama-workshop";
import type { StageContext } from "./stage-context";

const EMPTY: ProjectData = {
  projectInfo: { title: "T", type: "都市", episodes: 6, duration: "每集 60 秒", ratio: "9:16", logline: "L", mainline: "" },
  topicCards: [],
  episodes: [],
  characters: [],
  script: { ep: 1, scenes: [] },
  storyboard: { ep: 1, scenes: [] },
  promptPack: { ep: 1, scene: "", shots: [] },
};

const drafted = (n: number) => Array.from({ length: n }, (_, i) => ({ no: i + 1, content: `E${i + 1}` }));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => {
    for (let i = 0; i < 8; i++) await Promise.resolve();
  });
}

/**
 * 模拟工作台页面：文档与 ctx 挂在页面上（切阶段不卸载），OutlineStage 可以单独卸载 / 重挂（= 切阶段）。
 * 与 page.tsx 同语义：patchData 按最新文档合并。
 */
function Page({ showStage, saves }: { showStage: boolean; saves: ProjectData[] }) {
  const [data, setData] = React.useState(EMPTY);
  const ref = React.useRef(data);
  const ctx = React.useMemo<StageContext>(
    () => ({
      projectId: "p-remount",
      saveData: async (next) => {
        ref.current = next;
        setData(next);
        saves.push(next);
      },
      patchData: async (patch) => {
        const next = patch(ref.current);
        ref.current = next;
        setData(next);
        saves.push(next);
      },
    }),
    [saves],
  );
  return showStage ? <OutlineStage state={{} as never} dispatch={() => {}} data={data} ctx={ctx} /> : <div />;
}

const firstGenButton = () => within(screen.getByTestId("outline-gen-first")).getByRole("button");

describe("分集剧情生成：切走再切回来也只写一次（复核 remount）", () => {
  beforeEach(async () => {
    outlineAiDraft.mockReset();
    const { DRAMA_CONFIG_DEFAULTS } = await vi.importActual<typeof import("@/api/drama-config")>("@/api/drama-config");
    getDramaConfig.mockReset();
    getDramaConfig.mockImplementation(() => Promise.resolve(DRAMA_CONFIG_DEFAULTS));
  });
  afterEach(cleanup);

  it("生成中切走再切回来：新按钮点了不算，只发一次请求；结果照样落库", async () => {
    const d = deferred<ReturnType<typeof drafted>>();
    outlineAiDraft.mockReturnValue(d.promise);
    const saves: ProjectData[] = [];
    const { rerender } = render(<Page showStage saves={saves} />);

    fireEvent.click(firstGenButton());
    await flush();
    expect(outlineAiDraft).toHaveBeenCalledTimes(1);

    // 切去逐集制作（OutlineStage 卸载），再切回来（新实例）
    rerender(<Page showStage={false} saves={saves} />);
    rerender(<Page showStage saves={saves} />);
    await flush();

    // 新实例显示在途，不再摆出能点的生成按钮（分集剧情还没落库，以前这里又是空态 + 按钮）
    expect(screen.queryByTestId("outline-gen-first")).toBeNull();
    expect(outlineAiDraft).toHaveBeenCalledTimes(1);

    await act(async () => d.resolve(drafted(6)));
    await flush();
    expect(outlineAiDraft).toHaveBeenCalledTimes(1);
    expect(saves).toHaveLength(1);
    expect(saves[0].episodes).toHaveLength(6);
  });

  it("上一次失败之后锁会放开：切回来可以重试", async () => {
    const d = deferred<ReturnType<typeof drafted>>();
    outlineAiDraft.mockReturnValueOnce(d.promise).mockResolvedValueOnce(drafted(6));
    const saves: ProjectData[] = [];
    const { rerender } = render(<Page showStage saves={saves} />);

    fireEvent.click(firstGenButton());
    await flush();
    rerender(<Page showStage={false} saves={saves} />);
    await act(async () => d.reject(new Error("boom")));
    await flush();
    rerender(<Page showStage saves={saves} />);
    await flush();

    fireEvent.click(firstGenButton());
    await flush();
    expect(outlineAiDraft).toHaveBeenCalledTimes(2);
    expect(saves.at(-1)?.episodes).toHaveLength(6);
  });

  it("配置还没回来就切走再切回来、又点了一次：两次点击也只发一次请求", async () => {
    const { DRAMA_CONFIG_DEFAULTS } = await vi.importActual<typeof import("@/api/drama-config")>("@/api/drama-config");
    const cfg = deferred<typeof DRAMA_CONFIG_DEFAULTS>();
    getDramaConfig.mockImplementation(() => cfg.promise);
    outlineAiDraft.mockResolvedValue(drafted(6));
    const saves: ProjectData[] = [];
    const { rerender } = render(<Page showStage saves={saves} />);

    fireEvent.click(firstGenButton()); // 第一个实例：卡在读配置
    await flush();
    rerender(<Page showStage={false} saves={saves} />);
    rerender(<Page showStage saves={saves} />);
    await flush();
    fireEvent.click(firstGenButton()); // 第二个实例：请求还没发，按钮还在
    await flush();

    await act(async () => cfg.resolve(DRAMA_CONFIG_DEFAULTS));
    await flush();
    expect(outlineAiDraft).toHaveBeenCalledTimes(1);
    expect(saves).toHaveLength(1);
  });
});
