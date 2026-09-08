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
import zhCN from "antd/locale/zh_CN";
import { AlertCircle, CheckCircle2, Loader2, Send } from "lucide-react";
import CanvasPage from "@/canvas/pages/canvas/project";
import { useProjectSync } from "@/canvas-bridge/project-sync";
import { setModelsUnavailableHandler } from "@/canvas-bridge/config-store";
import { serverModelsLoaded } from "@/canvas-bridge/models";
import { PublishDialog } from "@/components/publish/publish-dialog";
import { IpStudioApi } from "@/api";
import { AIAVATAR_URL } from "@/lib/external";
import "@/canvas-bridge/i18n";

const SAVE_LABEL: Record<string, string> = {
  saving: "保存中",
  saved: "已保存",
  failed: "没保存上，改动还在本地",
  conflict: "这个项目在别处被改过了 · 刷新后再继续",
};

function Host({ projectId }: { projectId: string }) {
  const { state, error, saveState, publishedAvatarId, setPublishedAvatarId } = useProjectSync(projectId);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const { message } = AntdApp.useApp();

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

  return (
    <div className="h-full relative">
      <CanvasPage />

      {/* 画布右上角这一条是我们加的，不在搬来的画布里 —— 保持 src/canvas 干净，
          将来跟上游合并时这块不会冲突。 */}
      <div className="absolute top-3 right-4 z-50 flex items-center gap-2">
        {saveState !== "idle" && (
          <span
            className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold pointer-events-none max-w-[40vw] truncate"
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
            className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95 max-w-[46vw]"
            style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
            title={`已发布为 ${publishedAvatarId}，点开去数字资产平台查看`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">已发布 · {publishedAvatarId}</span>
          </a>
        ) : (
          <button
            onClick={() => setPublishOpen(true)}
            className="h-8 px-3.5 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95"
            style={{ background: "var(--action)", color: "var(--on-action)" }}
          >
            <Send className="w-3.5 h-3.5" />
            发布
          </button>
        )}
      </div>

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

export function CanvasHost({ projectId }: { projectId: string }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: "#495b91", borderRadius: 9, fontFamily: "var(--font-sans)" },
      }}
    >
      <AntdApp>
        <Host projectId={projectId} />
      </AntdApp>
    </ConfigProvider>
  );
}
