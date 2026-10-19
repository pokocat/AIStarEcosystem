"use client";
import { StudioErrorNotice, useStudioApp } from './studio-errors';

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
import { App as AntdApp, ConfigProvider, Popover, theme } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import zhCN from "antd/locale/zh_CN";
import { AlertCircle, BadgeCheck, CheckCircle2, Ellipsis, LayoutTemplate, Loader2, RefreshCw, Send } from "lucide-react";
import StudioFlowCanvas from "./studio-flow-canvas";
import { useProjectSync } from "@/canvas-bridge/project-sync";
import { setModelsUnavailableHandler } from "@/canvas-bridge/config-store";
import { serverModelsLoaded } from "@/canvas-bridge/models";
import { useHostActions } from "@/canvas-bridge/host-actions";
import { publishWithLatestDoc } from "@/canvas-bridge/publish-gate";
import { registerStudioSave } from "@/canvas-bridge/studio-save";
import { PublishDialog } from "@/ip/publish/publish-dialog";
import { ProjectHistory } from "@/ip/project-history";
import { CanvasConflictDialog } from "@/ip/canvas-conflict-dialog";
import { StudioTemplatePublish } from "@/ip/studio-template-publish";
import { StudioTemplateSource } from "@/ip/studio-template-source";
import { USE_MOCK } from "@ai-star-eco/api-client";
import { useAssetStore } from "@/canvas/stores/use-asset-store";
import { LastRunPanel } from "@/ip/last-run-panel";
import { IpStudioApi } from "@/ip/api";
import { useIdentity, isSuperAdminRole } from "@/proto/api";
import "@/canvas-bridge/i18n";

const SAVE_LABEL: Record<string, string> = {
  dirty: "未保存",
  saving: "保存中",
  saved: "已保存",
  failed: "没保存上，改动还在本地",
  conflict: "别处改过了，这里的改动没存上",
};

function Host({ projectId }: { projectId: string }) {
  const { state, error, saveState, publishedAvatarId, setPublishedAvatarId, saveNow, retrySave, resolveConflict, remoteRefreshes } = useProjectSync(projectId);
  React.useEffect(() => registerStudioSave(projectId, saveNow), [projectId, saveNow]);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [templateVisibility, setTemplateVisibility] = React.useState<'personal'|'official'>('personal');
  const { message } = useStudioApp();

  // 撞上别处的编辑：弹窗自动开一次让用户选；关掉之后顶栏徽标变成「处理冲突」能再打开。
  const [conflictOpen, setConflictOpen] = React.useState(false);
  React.useEffect(() => { setConflictOpen(saveState === "conflict"); }, [saveState]);
  // 别的标签页存了新版、这里没改过东西 → 已经悄悄换成最新内容了，轻轻说一声就够
  React.useEffect(() => { if (remoteRefreshes > 0) message.info("这张画布在别的窗口改过了，已经换成最新内容"); }, [remoteRefreshes, message]);

  // 「存为官方内容」只给超级管理员看 —— 普通用户/运营看到一个点了必然 403 的按钮更糟。
  // operatorRole 是账号上的内嵌运营角色（InAppOperatorGuard 判的也是它）。
  // 本 app 不挂共享 AuthProvider（它自带一套鉴权栈），所以这里读 aiavatar 自己的
  // identity。搬过来的画布**只有这一处**用到登录态，也是整个 vendored canvas 目录
  // 里唯一与鉴权有关的地方 —— 为它再挂一套 AuthProvider 得不偿失（两套状态机、
  // mock 模式还会失效）。判定逻辑复用 proto/api 的 isOperatorRole，与内嵌运营后台同源。
  const identity = useIdentity();
  // v0.192 收敛到超管：存为官方内容会出现在**所有人**的「新建画布」那一排里，
  // 一键生效、无复核、素材还复制进平台自有存储。与服务端
  // InAppOperatorGuard.requireSuperAdmin 对齐 —— 两边不一致的话，
  // 运营会看到一个点了必然 403 的按钮。
  React.useEffect(() => { const store = useAssetStore.getState(); store.reset(); void store.loadAssets(); return () => store.reset(); }, [identity?.uid]);
  const isOperator = isSuperAdminRole(identity?.operatorRole);
  React.useEffect(() => {
    if (state !== "ready") return;
    let leaving = false;
    const guard = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const dest = new URL(target.href, window.location.href);
      if (dest.origin !== window.location.origin || dest.pathname === window.location.pathname) return;
      event.preventDefault(); event.stopPropagation();
      if (leaving) return;
      leaving = true;
      void saveNow().then((outcome) => {
        // 冲突：直接把选出路的弹窗打开，别再弹一条「请先处理保存问题」让人自己找
        if (outcome === "conflict") { setConflictOpen(true); leaving = false; }
        else if (outcome === "failed") { message.error("画布尚未保存，已留在当前页面，请先处理保存问题"); leaving = false; }
        else window.location.assign(dest.href);
      }).catch((e) => { message.error(e); leaving = false; });
    };
    document.addEventListener("click", guard, true);
    return () => document.removeEventListener("click", guard, true);
  }, [state, saveNow, message]);

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
      message.error({ code: serverModelsLoaded() ? "STUDIO_MODEL_NOT_CONFIGURED" : "STUDIO_MODELS_UNAVAILABLE", message: serverModelsLoaded()
          ? "平台还没配可用的模型，现在生成不了。找管理员在后台加一个。"
          : "模型列表没加载上，刷新页面再试" });
    });
    return () => setModelsUnavailableHandler(null);
  }, [message]);

  // hook 必须在早返回之前调 —— 放在 loading / error 分支之后就是条件调用 hook，
  // React 会在状态切换的那一刻抛「Rendered more hooks than during the previous render」。
  // 画布还没加载完时插槽内容也无所谓，反正顶栏那会儿还没渲染。
  useHostActions(
    <>
      {/* 低频项（历史记录、上次发给模型、模板来源、存为模板）收进「⋯」，顶栏只留保存状态、发布和积分（画布页改版，2026-10-19）。 */}
      <Popover trigger="click" placement="bottomRight" getPopupContainer={modalContainerOf} content={<div className="studio-host-more" role="group" aria-label="画布更多操作">
        <ProjectHistory projectId={projectId} saveNow={saveNow} />
        <LastRunPanel />
        {!USE_MOCK && <><StudioTemplateSource projectId={projectId}/><button type="button" onClick={()=>{setTemplateVisibility('personal');setTemplateOpen(true);}} className="studio-host-more-item"><LayoutTemplate aria-hidden="true"/>保存为模板</button></>}
        {isOperator && (
          <button
            type="button"
            onClick={()=>{setTemplateVisibility('official');setTemplateOpen(true);}}
            className="studio-host-more-item"
            title="完整保存画布和素材，所有用户都能查看"
          >
            <BadgeCheck aria-hidden="true" />
            存为官方内容
          </button>
        )}
      </div>}>
        <button type="button" aria-label="更多" title="历史记录、上次发给模型、模板" className="studio-host-more-button"><Ellipsis className="w-4 h-4" /></button>
      </Popover>
      {/* 设计稿 Main 画板：保存状态是标题旁的一行灰字，不是胶囊；顶栏右侧依次是「⋯」、积分、发布（顺序由 studio-flow.css 排）。 */}
      {saveState !== "idle" && (
        <span
          className={`studio-host-save${saveState === "failed" || saveState === "conflict" ? " is-error" : ""}`}
          title={SAVE_LABEL[saveState]}
        >
          {SAVE_LABEL[saveState]}
        </span>
      )}
      {/* 冲突不给「重试」（自动重试就是覆盖别处的改动），给的是一个能打开弹窗选出路的按钮 ——
          此前只有徽标上一句「刷新后再改」，而 F5 还会被「离开页面？」拦住。 */}
      {saveState === "conflict" && (
        <button
          onClick={() => setConflictOpen(true)}
          className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95 whitespace-nowrap"
          style={{ background: "var(--err)", color: "var(--on-action)" }}
          title="选一种处理方式：另存一份 / 换成最新内容 / 以这里为准"
        >
          <AlertCircle className="w-3.5 h-3.5" />
          处理冲突
        </button>
      )}
      {/* 存不上时给一个真的能点的重试 —— 此前只有那个小徽标，用户唯一的办法是
          「再随便改一下」去触发下一次防抖（冲突不给重试：重试就是覆盖别处的改动）。 */}
      {saveState === "failed" && (
        <button
          onClick={() => void retrySave()}
          className="studio-host-save h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95 whitespace-nowrap"
          style={{ background: "var(--err-soft)", color: "var(--err)" }}
          title="再存一次。改动还在这个页面上，先别关"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          重试保存
        </button>
      )}
      {publishedAvatarId ? (
        // 已发布就别再给一个会 409 的按钮 —— 直接给能用的那条路：去资产库看它
        <a
          href={`/assets/${publishedAvatarId}`}
          className="studio-host-publish h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95 max-w-[220px]"
          style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
          title={`已发布为 ${publishedAvatarId}，点开去资产库看`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">已发布 · {publishedAvatarId}</span>
        </a>
      ) : (
        <button
          onClick={() => setPublishOpen(true)}
          className="studio-host-publish h-8 px-3.5 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95 whitespace-nowrap"
          style={{ background: "var(--ink)", color: "var(--surface)" }}
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
        <p className="text-[13px] max-w-sm" style={{ color: "var(--ink-2)" }}>画布暂时无法打开</p>
        <StudioErrorNotice error={error}/>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl text-[12.5px] font-bold transition hover:brightness-95"
          style={{ background: "var(--ink)", color: "var(--surface)" }}
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
      <StudioFlowCanvas projectId={projectId}/>
      <CanvasConflictDialog
        open={conflictOpen}
        onClose={() => setConflictOpen(false)}
        resolve={resolveConflict}
        onCopySaved={(copyId) => message.success({ content: <span>这里的改动已另存为新画布，<a href={`/projects/${copyId}`} target="_blank" rel="noreferrer">打开看看</a></span>, duration: 8 })}
      />
      {templateOpen && <StudioTemplatePublish projectId={projectId} superAdmin={isOperator} initialVisibility={templateVisibility} saveNow={saveNow} onClose={()=>setTemplateOpen(false)}/>}

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        // **先把画布存上再发布**（v0.179，理由见 canvas-bridge/publish-gate.ts）：
        // 发布读的是库里那份文档，而弹窗看的是内存里的画布 —— 防抖窗口内点发布，
        // 服务端拿的是上一版，最坏是把上一张图登记成主形象而两边都不报错。
        onPublish={(payload) =>
          publishWithLatestDoc(saveNow, async () => {
            const res = await IpStudioApi.publishProject(projectId, payload);
            setPublishedAvatarId(res.avatarId);
            return res;
          })
        }
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

/** Popovers from the header stay inside the canvas shell so they stack with its floating panels. */
const modalContainerOf = () => document.querySelector<HTMLElement>(".studio-flow-shell")?.closest<HTMLElement>(".ip-surface") || document.body;
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
