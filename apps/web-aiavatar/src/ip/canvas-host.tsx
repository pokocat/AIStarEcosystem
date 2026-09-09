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
import { App as AntdApp, ConfigProvider, Modal, theme } from "antd";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import zhCN from "antd/locale/zh_CN";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Send, Star } from "lucide-react";
import CanvasPage from "@/canvas/pages/canvas/project";
import { useProjectSync } from "@/canvas-bridge/project-sync";
import { setModelsUnavailableHandler } from "@/canvas-bridge/config-store";
import { serverModelsLoaded } from "@/canvas-bridge/models";
import { useHostActions } from "@/canvas-bridge/host-actions";
import { publishWithLatestDoc } from "@/canvas-bridge/publish-gate";
import { PublishDialog } from "@/ip/publish/publish-dialog";
import { LastRunPanel } from "@/ip/last-run-panel";
import { useCanvasStore } from "@/canvas/stores/canvas/use-canvas-store";
import { IpStudioApi } from "@/ip/api";
import { useIdentity, isSuperAdminRole } from "@/proto/api";
import "@/canvas-bridge/i18n";

const SAVE_LABEL: Record<string, string> = {
  dirty: "未保存",
  saving: "保存中",
  saved: "已保存",
  failed: "没保存上，改动还在本地",
  conflict: "这张画布有更新的版本 · 刷新后再改",
};

function Host({ projectId }: { projectId: string }) {
  const { state, error, saveState, publishedAvatarId, setPublishedAvatarId, saveNow, retrySave } = useProjectSync(projectId);
  const [publishOpen, setPublishOpen] = React.useState(false);
  const { message } = AntdApp.useApp();

  // 「存为全局示例」只给超级管理员看 —— 普通用户/运营看到一个点了必然 403 的按钮更糟。
  // operatorRole 是账号上的内嵌运营角色（InAppOperatorGuard 判的也是它）。
  // 本 app 不挂共享 AuthProvider（它自带一套鉴权栈），所以这里读 aiavatar 自己的
  // identity。搬过来的画布**只有这一处**用到登录态，也是整个 vendored canvas 目录
  // 里唯一与鉴权有关的地方 —— 为它再挂一套 AuthProvider 得不偿失（两套状态机、
  // mock 模式还会失效）。判定逻辑复用 proto/api 的 isOperatorRole，与内嵌运营后台同源。
  const identity = useIdentity();
  // v0.192 收敛到超管：存为全局示例会出现在**所有人**的工作流目录里，
  // 一键生效、无复核、素材还复制进平台自有存储。与服务端
  // InAppOperatorGuard.requireSuperAdmin 对齐 —— 两边不一致的话，
  // 运营会看到一个点了必然 403 的按钮。
  const isOperator = isSuperAdminRole(identity?.operatorRole);
  const [savingDemo, setSavingDemo] = React.useState(false);
  // 画布当前标题（画布 store 是这份的真值，顶栏改名改的也是它）
  const canvasTitle = useCanvasStore(
    (st) => st.projects.find((p) => p.id === projectId)?.title ?? "",
  );
  // 存为示例前先弹一次确认。理由有两条，都不是走流程：
  //   ① 这一下是**推给全平台每一个用户**的，不该和「保存」一样一点就发生；
  //   ② 示例在目录里显示的是这个名字，而画布标题往往是「未命名 IP 项目」——
  //      不给改名的话，所有人看到的就是一排「未命名」。
  const [demoOpen, setDemoOpen] = React.useState(false);
  const [demoName, setDemoName] = React.useState("");
  const [demoSummary, setDemoSummary] = React.useState("");

  const openDemoDialog = React.useCallback(() => {
    // 预填当前画布名，多数情况下改一两个字就能用
    setDemoName(canvasTitle || "");
    setDemoSummary("");
    setDemoOpen(true);
  }, [canvasTitle]);

  const saveAsDemo = React.useCallback(async () => {
    const name = demoName.trim();
    if (!name) return;
    setSavingDemo(true);
    try {
      // 先把当前画布存下来再快照 —— 否则示例里少了用户刚做的那几笔
      await saveNow();
      const demo = await IpStudioApi.publishAsDemo(projectId, {
        name,
        summary: demoSummary.trim() || undefined,
      });
      setDemoOpen(false);
      message.success(`已存为全局示例「${demo.name}」，所有人在工作流目录里都能看到`);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "存为示例没成功");
    } finally {
      setSavingDemo(false);
    }
  }, [projectId, saveNow, message, demoName, demoSummary]);

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
      <LastRunPanel />
      {isOperator && (
        <button
          onClick={openDemoDialog}
          disabled={savingDemo}
          className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-semibold transition hover:brightness-95 whitespace-nowrap disabled:opacity-60"
          style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
          title="把这张画布连素材复制一份存成全局示例，新用户一进工作流目录就能看到效果"
        >
          <Star className="w-3.5 h-3.5 shrink-0" />
          存为全局示例
        </button>
      )}
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
      {/* 存不上时给一个真的能点的重试 —— 此前只有那个小徽标，用户唯一的办法是
          「再随便改一下」去触发下一次防抖（冲突不给重试：重试就是覆盖别处的改动）。 */}
      {saveState === "failed" && (
        <button
          onClick={() => void retrySave()}
          className="h-8 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-bold transition hover:brightness-95 whitespace-nowrap"
          style={{ background: "var(--err-soft)", color: "var(--err)" }}
          title="再试一次保存。改动还在这个页面上，别关它"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          重试保存
        </button>
      )}
      {publishedAvatarId ? (
        // 已发布就别再给一个会 409 的按钮 —— 直接给能用的那条路：去资产库看它
        <a
          href={`/assets/${publishedAvatarId}`}
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

      {/* 存为全局示例的确认框。刻意不是「点了就发生」——
          这一下会把画布连素材复制成**所有人**都看得到的内容；而且目录里显示的是
          这里填的名字，画布标题常常还是「未命名 IP 项目」，不给改就是一排「未命名」。 */}
      <Modal
        open={demoOpen}
        title="存为全局示例"
        onCancel={() => setDemoOpen(false)}
        onOk={() => void saveAsDemo()}
        okText={savingDemo ? "保存中…" : "确认存为示例"}
        cancelText="取消"
        okButtonProps={{ loading: savingDemo, disabled: !demoName.trim() }}
        cancelButtonProps={{ disabled: savingDemo }}
        mask={{ closable: !savingDemo }}
        keyboard={!savingDemo}
        closable={!savingDemo}
        getContainer={() => document.querySelector<HTMLElement>(".ip-surface") ?? document.body}
      >
        <p style={{ fontSize: 12.5, lineHeight: 1.75, color: "var(--ink-2)", margin: "0 0 14px" }}>
          会把当前画布**连同素材复制一份**存成示例，出现在所有用户的工作流目录里。
          原项目不受影响，之后改它或删它都不会动到示例。
        </p>
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-2)", marginBottom: 5 }}>
          示例名称
        </label>
        <input
          value={demoName}
          onChange={(e) => setDemoName(e.target.value)}
          placeholder="目录里显示的名字"
          autoFocus
          style={DEMO_FIELD}
        />
        <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--ink-2)", margin: "12px 0 5px" }}>
          一句话说明<span style={{ fontWeight: 400, color: "var(--ink-4)" }}>（选填）</span>
        </label>
        <input
          value={demoSummary}
          onChange={(e) => setDemoSummary(e.target.value)}
          placeholder="这条示例能让人看到什么"
          style={DEMO_FIELD}
        />
      </Modal>
    </div>
  );
}

const DEMO_FIELD: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px",
  border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)",
  background: "var(--surface)", color: "var(--ink)",
  fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, outline: "none",
};

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
