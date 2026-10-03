"use client";

// 角色和场景（v0.198，真源 docs/drama-canvas-plan.md §2.4）：两种看法。
//   ?view=board|list（缺省 list）  &tab=characters|scenes|materials（列表的页签）
//   &focus=look:<id>|scene:<id>|character:<id>（画布打开时定位到它）
// ≤720 永远是列表（手机上不进画布，顶栏也不给切换）。
// 画布（React Flow）只在打开画布时才加载：dynamic(ssr:false)，列表页不下那一块。
import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Workflow } from "lucide-react";
import { ASSET_TABS, AssetListView, useNarrow, type AssetTab } from "@/canvas/assets";
import { CanvasTopbarSlot } from "@/canvas/shell";

function Loading() {
  return (
    <div className="cva-loading" aria-busy="true">
      正在打开…
    </div>
  );
}

const BoardView = dynamic(() => import("@/canvas/board/board-view"), {
  ssr: false,
  loading: () => <Loading />,
});

type View = "board" | "list";

function readTab(v: string | null): AssetTab {
  return ASSET_TABS.includes(v as AssetTab) ? (v as AssetTab) : "characters";
}

function AssetsPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const narrow = useNarrow();

  const view: View = !narrow && params?.get("view") === "board" ? "board" : "list";
  const tab = readTab(params?.get("tab") ?? null);
  const focus = params?.get("focus") ?? undefined;

  const go = React.useCallback(
    (patch: Record<string, string | null>, mode: "push" | "replace") => {
      const next = new URLSearchParams(params?.toString() ?? "");
      for (const [k, v] of Object.entries(patch)) {
        if (v == null) next.delete(k);
        else next.set(k, v);
      }
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (mode === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [params, pathname, router],
  );

  return (
    <>
      {!narrow && (
        <CanvasTopbarSlot slot="right">
          <div className="cv-seg cva-view-switch" role="group" aria-label="看法">
            <button type="button" className={view === "board" ? "on" : ""} aria-pressed={view === "board"} onClick={() => go({ view: "board", focus: null }, "replace")}>
              <Workflow size={13} /> 画布
            </button>
            <button type="button" className={view === "list" ? "on" : ""} aria-pressed={view === "list"} onClick={() => go({ view: null, focus: null }, "replace")}>
              <LayoutGrid size={13} /> 列表
            </button>
          </div>
        </CanvasTopbarSlot>
      )}
      {view === "board" ? (
        <BoardView focus={focus} />
      ) : (
        <AssetListView
          tab={tab}
          onTabChange={(t) => go({ tab: t === "characters" ? null : t }, "replace")}
          onLocate={(f) => go({ view: "board", focus: f }, "push")}
          focus={focus}
        />
      )}
    </>
  );
}

export default function CanvasAssetsPage() {
  // useSearchParams 要包一层 Suspense（Next 16 预渲染时要求）
  return (
    <React.Suspense fallback={<Loading />}>
      <AssetsPageInner />
    </React.Suspense>
  );
}
