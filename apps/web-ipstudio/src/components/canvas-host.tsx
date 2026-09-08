"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 画布宿主 —— 把搬来的画布（src/canvas）接到本仓的路由、账号与服务端上。
//
// 三件事：
//   ① antd 的 App / ConfigProvider（画布用 message、modal，没有 provider 会静默失效）
//   ② 从服务端把项目拉下来再渲染画布 —— 拉完之前不能渲染，否则画布会认为
//      「这个项目是空的」，紧接着的自动保存把服务端真正的内容覆盖掉
//   ③ 保存状态给用户看得见
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import zhCN from "antd/locale/zh_CN";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import CanvasPage from "@/canvas/pages/canvas/project";
import { useProjectSync } from "@/canvas-bridge/project-sync";
import { setModelsUnavailableHandler } from "@/canvas-bridge/config-store";
import { serverModelsLoaded } from "@/canvas-bridge/models";
import { useHostActions } from "@/canvas-bridge/host-actions";
import { PublishDialog } from "@/components/publish/publish-dialog";
import { IpStudioApi } from "@/api";
import { AIAVATAR_URL } from "@/lib/external";
import "@/canvas-bridge/i18n";

const SAVE_LABEL: Record<string, string> = {
  saving: "保存中",
  saved: "已保存",
  failed: "没保存上，改动还在本地",
  conflict: "这张画布有更新的版本 · 刷新后再改",
};

function Host({ projectId }: { projectId: string }) {
  const { state, error, saveState, publishedAvatarId, setPublishedAvatarId } = useProjectSync(projectId);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const { message } = AntdApp.useApp();

  // 捏合 / Ctrl+滚轮 只缩放画布，不缩放整个网站。
  //
  // 画布自己在容器上挡了滚轮，但放过了 `[data-canvas-no-zoom]`、antd 弹层这些区域
  // （为了让它们内部能正常滚动）—— 于是光标落在节点面板、下拉、弹窗上时捏合，
  // 浏览器就把整个站点缩放了，而且缩完很难恢复。
  //
  // 分寸：**只挡缩放手势，不挡滚动**。滚动是那些区域真正需要的；
  // 缩放在画布应用里从来都该由画布接管（Figma / Miro 都是这么做的）。
  // Safari 的捏合走的是 gesture* 事件，不是 wheel，得单独挡。
  React.useEffect(() => {
    const blockZoom = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };
    const blockGesture = (e: Event) => e.preventDefault();
    document.addEventListener("wheel", blockZoom, { passive: false });
    document.addEventListener("gesturestart", blockGesture);
    document.addEventListener("gesturechange", blockGesture);
    document.addEventListener("gestureend", blockGesture);
    return () => {
      document.removeEventListener("wheel", blockZoom);
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("gestureend", blockGesture);
    };
  }, []);

  // 画布在「没有可用模型」时本来会弹上游那个填 API Key 的对话框 —— 那是它作为单机工具的
  // 设计。本仓的 Key 在服务端，用户在那个表单里什么也做不了，只会以为是自己没配好。
  React.useEffect(() => {
    setModelsUnavailableHandler(() => {
      message.warning(
        serverModelsLoaded()
          ? "平台还没有可用的模型，生成暂时用不了 —— 请联系管理员在后台配置。"
          : "模型列表没加载上，刷新页面再试。",
      );
    });
    return () => setModelsUnavailableHandler(null);
  }, [message]);

  // hook 必须在早返回之前调 —— 放在 loading / error 分支之后就是条件调用 hook，
  // React 会在状态切换的那一刻抛「Rendered more hooks than during the previous render」。
  // 画布还没加载完时插槽内容也无所谓，反正顶栏那会儿还没渲染。
  useHostActions(
    <>
      {saveState !== "idle" && (
        <span
          className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold whitespace-nowrap"
          style={
            saveState === "failed" || saveState === "conflict"
              ? { background: "var(--err-soft)", color: "var(--err)" }
              : { background: "var(--surface-2)", color: "var(--ink-3)" }
          }
          title={SAVE_LABEL[saveState]}
        >
          {SAVE_LABEL[saveState]}
        </span>
      )}
      {publishedAvatarId ? (
        // 已发布就别再给一个会 409 的按钮 —— 直接给能用的那条路：去资产库看它
        <a
          href={`${AIAVATAR_URL}/assets/${publishedAvatarId}`}
          target="_blank"
          rel="noreferrer"
          className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95 max-w-[220px]"
          style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
          title={`已发布为 ${publishedAvatarId}，点开去数字资产平台查看`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">已发布 · {publishedAvatarId}</span>
        </a>
      ) : (
        <button
          onClick={() => setPublishOpen(true)}
          className="h-8 px-3.5 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95 whitespace-nowrap"
          style={{ background: "var(--action)", color: "var(--on-action)" }}
        >
          <Send className="w-3.5 h-3.5" />
          发布
        </button>
      )}
    </>,
  );

  if (state === "loading") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
        <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>正在打开画布…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
        <AlertCircle className="w-6 h-6" style={{ color: "var(--err)" }} />
        <p className="text-[13px] max-w-sm" style={{ color: "var(--ink-2)" }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl text-[12.5px] font-bold transition hover:brightness-95"
          style={{ background: "var(--action)", color: "var(--on-action)" }}
        >
          重新加载
        </button>
      </div>
    );
  }

  // 放进画布顶栏那一行（见 canvas-bridge/host-actions.tsx）——
  // 此前是绝对定位浮在右上角，正好压住画布自己的「配置 / 快捷键 / Agent」。

  return (
    <div className="h-full relative">
      <CanvasPage />

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onPublish={async (payload) => {
          const res = await IpStudioApi.publishProject(projectId, payload);
          setPublishedAvatarId(res.avatarId);
          return res;
        }}
      />
    </div>
  );
}

/**
 * 画布里有两处用 react-query（节点提示词面板、侧边提示词库）。搬画布时漏了这个 provider，
 * 于是**双击任意节点就崩**：Error: No QueryClient set。上游在它自己的入口里建，
 * 我们只搬了画布没搬入口 —— 属于「搬进来之后要自己补齐运行环境」的那一类。
 *
 * 建在模块级而不是组件里：放组件里每次重渲染都会新建一个 client，缓存永远命中不了。
 */
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 5 * 60_000 } },
});

export function CanvasHost({ projectId }: { projectId: string }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: "#495b91", borderRadius: 9, fontFamily: "var(--font-sans)" },
      }}
    >
      {/* antd 的 App 会在 DOM 里插一个自己的 div。它默认没有高度，而画布靠 h-full 一层层
          往下继承 —— 断在这儿的结果是画布被压成内容高度（实测 312px），页面下半截全空。
          所以显式把高度给它。 */}
      <AntdApp className="h-full">
        <QueryClientProvider client={queryClient}>
          <Host projectId={projectId} />
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  );
}
