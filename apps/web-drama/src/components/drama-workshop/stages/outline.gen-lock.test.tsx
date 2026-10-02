import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

// WB1：分集剧情首次生成低于免确认阈值时，CreditButton 等配置回来之前可以再点一次。
// 这里把 CreditButton 换成「最坏情况」：每次点击都排一个回调，回调由测试决定什么时候放行
// （= 配置什么时候回来）。断的是行为：请求发了几次。§8.0.1 ⑩：不断言任何可视文案。
const gates: Array<() => unknown> = [];
vi.mock("@/components/drama-ui", () => ({
  CreditButton: ({
    onConfirm,
    children,
    className,
    disabled,
  }: {
    onConfirm: () => unknown;
    children?: React.ReactNode;
    className?: string;
    disabled?: boolean;
  }) => (
    <button type="button" className={className} disabled={disabled} onClick={() => gates.push(onConfirm)}>
      {children}
    </button>
  ),
  Editable: ({ value }: { value?: string }) => <span>{value}</span>,
  GenSkeleton: () => <div data-testid="gen-skeleton" />,
}));

const outlineAiDraft = vi.fn();
vi.mock("@/api", () => ({
  ProjectsApi: { outlineAiDraft: (id: string, count: number) => outlineAiDraft(id, count) },
}));

vi.mock("@/lib/use-drama-config", async () => {
  const { DRAMA_CONFIG_DEFAULTS } = await vi.importActual<typeof import("@/api/drama-config")>("@/api/drama-config");
  return { useDramaConfig: () => DRAMA_CONFIG_DEFAULTS };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

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
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** 外壳：持有文档，ctx.patchData 按最新文档合并（与工作台页面同语义）。 */
function Harness({ onSave }: { onSave: (d: ProjectData) => void }) {
  const [data, setData] = React.useState(EMPTY);
  const ref = React.useRef(data);
  const ctx = React.useMemo<StageContext>(
    () => ({
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
    }),
    [onSave],
  );
  return <OutlineStage state={{} as never} dispatch={() => {}} data={data} ctx={ctx} />;
}

const clickFirstGen = () => fireEvent.click(within(screen.getByTestId("outline-gen-first")).getByRole("button"));

describe("分集剧情生成的在途锁（WB1）", () => {
  beforeEach(() => {
    gates.length = 0;
    outlineAiDraft.mockReset();
  });
  afterEach(cleanup);

  it("配置回来之前连点两次：两个回调都放行，也只发一次请求", async () => {
    const d = deferred<ReturnType<typeof drafted>>();
    outlineAiDraft.mockReturnValue(d.promise);
    render(<Harness onSave={() => {}} />);
    clickFirstGen();
    clickFirstGen();
    expect(gates).toHaveLength(2);
    await act(async () => {
      void gates[0]();
      void gates[1]();
    });
    expect(outlineAiDraft).toHaveBeenCalledTimes(1);
    await act(async () => d.resolve(drafted(6)));
    expect(outlineAiDraft).toHaveBeenCalledTimes(1);
  });

  it("第一次写完之后第二个回调才到：也不会再写一次", async () => {
    outlineAiDraft.mockResolvedValue(drafted(6));
    const saves: ProjectData[] = [];
    render(<Harness onSave={(x) => saves.push(x)} />);
    clickFirstGen();
    clickFirstGen();
    await act(async () => {
      await gates[0]();
    });
    expect(saves.at(-1)?.episodes).toHaveLength(6);
    await act(async () => {
      await gates[1]();
    });
    expect(outlineAiDraft).toHaveBeenCalledTimes(1);
  });

  it("锁会放开：写完之后再点「全部重写」照常能写", async () => {
    outlineAiDraft.mockResolvedValue(drafted(6));
    render(<Harness onSave={() => {}} />);
    clickFirstGen();
    await act(async () => {
      await gates[0]();
    });
    fireEvent.click(within(await screen.findByTestId("outline-gen-rewrite")).getByRole("button"));
    await act(async () => {
      await gates[1]();
    });
    expect(outlineAiDraft).toHaveBeenCalledTimes(2);
  });

  it("失败之后锁也会放开，可以重试", async () => {
    outlineAiDraft.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(drafted(6));
    render(<Harness onSave={() => {}} />);
    clickFirstGen();
    await act(async () => {
      await gates[0]();
    });
    clickFirstGen();
    await act(async () => {
      await gates[1]();
    });
    expect(outlineAiDraft).toHaveBeenCalledTimes(2);
  });

  it("生成期间写回的角色不会被分集剧情的保存盖掉（按最新文档合并）", async () => {
    const d = deferred<ReturnType<typeof drafted>>();
    outlineAiDraft.mockReturnValue(d.promise);
    let latest: ProjectData = EMPTY;
    let external: StageContext | null = null;
    function Spy() {
      const [data, setData] = React.useState(EMPTY);
      const ref = React.useRef(data);
      const ctx = React.useMemo<StageContext>(
        () => ({
          projectId: "p1",
          saveData: async (next) => {
            ref.current = next;
            latest = next;
            setData(next);
          },
          patchData: async (patch) => {
            const next = patch(ref.current);
            ref.current = next;
            latest = next;
            setData(next);
          },
        }),
        [],
      );
      external = ctx;
      return <OutlineStage state={{} as never} dispatch={() => {}} data={data} ctx={ctx} />;
    }
    render(<Spy />);
    clickFirstGen();
    await act(async () => {
      void gates[0]();
    });
    const char = { id: "c1", name: "甲", role: "key" as const, cast: "", desc: "", avatar: "a1", bound: true, avatarId: "av1" };
    await act(async () => {
      await external!.patchData((prev) => ({ ...prev, characters: [char] }));
    });
    await act(async () => d.resolve(drafted(6)));
    expect(latest.episodes).toHaveLength(6);
    expect(latest.characters).toEqual([char]);
  });
});
