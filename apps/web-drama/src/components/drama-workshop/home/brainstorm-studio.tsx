"use client";

// 首页聊天页（chatOn）—— 设计真源 AI短剧工作台.dc.html `chatOn`：
// 桌面左右两栏：和 AI 聊 | 故事大纲（空 → 生成中 → 已生成，全部可编辑）→ 新建短剧 / 开始制作。
// 窄屏（≤860，v0.197）：顶部「对话 | 故事大纲」页签一次只显示一栏，大纲生成好自动切过去。
// 新建之前的可恢复草稿：?b=<id> 入 URL，整页 BrainstormData 防抖自动保存，刷新/返回可恢复。
// 去制作之后这段对话就封存了（服务端 promoted 只读，再存 409）：返回键 / 历史链接回到这页只能看，
// 底部换成「打开那部短剧 / 那条短视频」和「复制一份接着改」。以前这里照样能改，改完再点去制作
// 拿回的是旧的那一条（内容过期，删了的话还会 404），改动悄悄丢了。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUp,
  ChevronLeft,
  Clapperboard,
  Copy,
  RefreshCw,
  ScrollText,
  Sparkles,
  Zap,
} from "lucide-react";
import { BrainstormApi, ProjectsApi, ShortsApi } from "@/api";
import {
  BRAINSTORM_ALREADY_PROMOTED,
  QUICK_GO_TEMPLATES,
  promoteRequestId,
  type BrainstormData,
  type BrainstormDetail,
  type BrainstormForm,
  type BrainstormMessage,
} from "@/api/brainstorm";
import { invalidate, mutate, useAsync } from "@/lib/drama-query";
import { useSaveStatus } from "@/lib/use-save-status";
import { useDramaConfig } from "@/lib/use-drama-config";
import { notifyWalletChanged } from "@/lib/use-wallet";
import { SaveStatus } from "@/components/drama-workshop/save-status";
import { CreditMark, Editable, dramaConfirm } from "@/components/drama-ui";
import { PaneTabs } from "@/components/common/PaneTabs";
import { MarkdownLite } from "@/lib/markdown-lite";
import { aiErrorMessage } from "@/lib/ai-error";
import { SHORT_START_LEAD, confirmShortStart } from "@/components/drama-workshop/short-start-confirm";

const RATIOS: { k: string; label: string }[] = [
  { k: "9:16", label: "竖屏 9:16" },
  { k: "16:9", label: "横屏 16:9" },
  { k: "1:1", label: "方形 1:1" },
];
const RATIO_LABEL: Record<string, string> = { "9:16": "竖屏 9:16", "16:9": "横屏 16:9", "1:1": "方形 1:1" };
const FORM_LABEL: Record<BrainstormForm, string> = { series: "多集短剧", single: "单条短视频" };
/** 短视频固定竖屏（与 shorts/make 建草稿时写死的 ratio 一致）。 */
const SHORT_RATIO = "9:16";

/** 与 home.css 的窄屏断点一致（§5.1：两边用同一个值）。 */
const NARROW_QUERY = "(max-width: 860px)";
function isNarrow(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(NARROW_QUERY).matches;
}

type Pane = "chat" | "outline";

/** 这段对话去制作之后落成了什么。 */
type Promoted = { kind: "project" | "short"; id: string };
/** 落成的那一条还在不在（在列表里 = 在；列表里没有 = 删了或进了回收站；读失败 = 不确定，照常给打开）。 */
type TargetState = { state: "checking" } | { state: "ok"; title: string } | { state: "gone" } | { state: "unknown" };

function promotedOf(meta: BrainstormDetail["meta"] | undefined): Promoted | null {
  if (!meta || meta.status !== "promoted" || !meta.promotedId) return null;
  return { kind: meta.promotedKind === "short" ? "short" : "project", id: meta.promotedId };
}

function errorCode(e: unknown): string | undefined {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" ? c : undefined;
}

/** 从哪儿进来的：决定左上角「返回」回哪一页。 */
export type StudioFrom = "home" | "projects";
const BACK: Record<StudioFrom, { label: string; href: string }> = {
  home: { label: "返回首页", href: "/dashboard" },
  projects: { label: "返回我的短剧", href: "/projects" },
};

export function BrainstormStudio({ id, from = "home" }: { id: string; from?: StudioFrom }) {
  const router = useRouter();
  const back = BACK[from] ?? BACK.home;
  const cacheKey = `/me/drama/brainstorms/${id}`;
  // revalidateOnMount：返回键回到这页时重新读一遍 —— 这段对话可能已经在别的标签页去制作过了。
  const { data: detail, isLoading, error } = useAsync(cacheKey, () => BrainstormApi.getBrainstorm(id), {
    revalidateOnMount: true,
  });
  const promoted = promotedOf(detail?.meta);
  const promotedRef = React.useRef(promoted);
  promotedRef.current = promoted;

  const [data, setData] = React.useState<BrainstormData | null>(null);
  // 用户动过之后，缓存 / 后台刷新回来的那份不再盖掉页面上的内容（保存回写缓存也会走到这里）。
  const touched = React.useRef(false);
  React.useEffect(() => {
    const incoming = detail?.data;
    if (!incoming) return;
    setData((prev) => (prev && touched.current ? prev : incoming));
  }, [detail]);

  const { status: saveStatus, notifyEditing, track } = useSaveStatus();
  const cfg = useDramaConfig();
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 防抖窗口里还没发出去的那一份：离开页面时补发，不跟着定时器一起丢。 */
  const pendingSave = React.useRef<BrainstormData | null>(null);
  const saveSeq = React.useRef(0);
  const cachedSeq = React.useRef(0);
  /** 已经点了去制作、正在离开：别再去查「那一条还在不在」。 */
  const leaving = React.useRef(false);

  // 窄屏页签：当前显示哪一栏 + 另一栏有没有新内容（页签上打点）。
  const [pane, setPane] = React.useState<Pane>("chat");
  const [freshPane, setFreshPane] = React.useState<Pane | null>(null);
  const paneRef = React.useRef<Pane>("chat");
  const switchPane = React.useCallback((p: Pane) => {
    paneRef.current = p;
    setPane(p);
    setFreshPane((f) => (f === p ? null : f));
  }, []);
  /** 某一栏出了新东西：窄屏且需要时自动切过去，否则在页签上打点。 */
  const markFresh = React.useCallback(
    (p: Pane, autoSwitch: boolean) => {
      if (paneRef.current === p) return;
      if (autoSwitch && isNarrow()) switchPane(p);
      else setFreshPane(p);
    },
    [switchPane],
  );

  /** 真正落库一次；存好的那份写回缓存，返回键回到这页看到的就是它，而不是第一次打开时的旧样子。 */
  const persist = React.useCallback(
    async (next: BrainstormData) => {
      const seq = ++saveSeq.current;
      try {
        const saved = await track(() => BrainstormApi.saveBrainstorm(id, next));
        if (seq >= cachedSeq.current) {
          cachedSeq.current = seq;
          mutate(cacheKey, saved);
        }
      } catch (e) {
        if (errorCode(e) === BRAINSTORM_ALREADY_PROMOTED) {
          // 别的标签页已经拿这段对话去制作了：重读一遍，页面切成只读，不再假装能存。
          invalidate(cacheKey);
          toast(aiErrorMessage(e, "这段对话已经拿去制作了，这里的改动不会再保存"));
        }
        throw e;
      }
    },
    [id, cacheKey, track],
  );
  const cancelPendingSave = React.useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    pendingSave.current = null;
  }, []);

  // 防抖落库（编辑大纲 / 设置）。
  const patch = React.useCallback(
    (next: BrainstormData) => {
      if (promotedRef.current) return;
      touched.current = true;
      setData(next);
      notifyEditing();
      cancelPendingSave();
      pendingSave.current = next;
      saveTimer.current = setTimeout(() => {
        pendingSave.current = null;
        void persist(next).catch(() => {});
      }, 700);
    },
    [notifyEditing, cancelPendingSave, persist],
  );
  // 立即落库（AI 出对话 / 大纲后，确保不丢）。
  const flush = React.useCallback(
    async (next: BrainstormData) => {
      if (promotedRef.current) return;
      touched.current = true;
      setData(next);
      cancelPendingSave();
      try {
        await persist(next);
      } catch {
        /* 出错下次编辑再保存；指示器已反映 */
      }
    },
    [cancelPendingSave, persist],
  );
  // 离开页面时防抖还没到点：把那一份补发出去（以前是直接清掉定时器，最后一处改动就丢了）。
  React.useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const last = pendingSave.current;
      pendingSave.current = null;
      if (last && !promotedRef.current) {
        void BrainstormApi.saveBrainstorm(id, last).then((saved) => mutate(cacheKey, saved)).catch(() => {});
      }
    },
    [id, cacheKey],
  );

  // 封存的对话在窄屏上直接落在「故事大纲」那一栏：打开 / 复制的按钮在那边，对话这边已经没有能做的事。
  const isSealed = !!promoted;
  React.useEffect(() => {
    if (isSealed) markFresh("outline", true);
  }, [isSealed, markFresh]);

  // 去制作过的对话：确认落成的那一条还在不在，决定底部给「打开」还是只给「复制一份接着改」。
  const [target, setTarget] = React.useState<TargetState>({ state: "checking" });
  const promotedKind = promoted?.kind;
  const promotedId = promoted?.id;
  React.useEffect(() => {
    if (!promotedKind || !promotedId || leaving.current) return;
    let alive = true;
    setTarget({ state: "checking" });
    const lookup: Promise<string | undefined> =
      promotedKind === "short"
        ? ShortsApi.listDrafts().then((list) => list.find((x) => x.id === promotedId)?.title)
        : ProjectsApi.listProjects().then((list) => list.find((x) => x.id === promotedId)?.title);
    lookup
      .then((title) => {
        if (alive) setTarget(title !== undefined ? { state: "ok", title } : { state: "gone" });
      })
      .catch(() => {
        if (alive) setTarget({ state: "unknown" });
      });
    return () => {
      alive = false;
    };
  }, [promotedKind, promotedId]);

  const [input, setInput] = React.useState("");
  const [typing, setTyping] = React.useState(false);
  const [outlineLoading, setOutlineLoading] = React.useState(false);
  const [producing, setProducing] = React.useState(false);
  const chatScrollRef = React.useRef<HTMLDivElement>(null);
  const chatInputRef = React.useRef<HTMLInputElement>(null);
  const sending = React.useRef(false);
  const kicked = React.useRef(false);

  React.useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [data?.messages, typing, pane]);

  const send = React.useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || !data || sending.current || promotedRef.current) return;
      sending.current = true;
      setInput("");
      const userMsg: BrainstormMessage = { role: "user", text: t };
      const withUser: BrainstormData = { ...data, messages: [...data.messages, userMsg] };
      touched.current = true;
      setData(withUser);
      setTyping(true);
      try {
        const { message } = await BrainstormApi.chat(id, t, withUser.messages);
        const next: BrainstormData = { ...withUser, messages: [...withUser.messages, message] };
        setTyping(false);
        await flush(next);
        markFresh("chat", false);
      } catch (e) {
        setTyping(false);
        await flush(withUser);
        toast.error(aiErrorMessage(e, "AI 没回上来，请再发一次"));
      } finally {
        sending.current = false;
      }
    },
    [data, id, flush, markFresh],
  );

  // 快捷回复：「去模板广场看看」这类是跳转，不是发给 AI 的话。
  const onQuick = React.useCallback(
    (q: string) => {
      if (QUICK_GO_TEMPLATES.has(q.trim())) {
        router.push("/templates");
        return;
      }
      void send(q);
    },
    [router, send],
  );

  // 带 seed 进来：自动把首条点子发出去，触发第一条 AI 回复（只跑一次）。
  React.useEffect(() => {
    if (kicked.current || !data || promoted) return;
    const onlyGreeting = data.messages.length === 1 && data.messages[0].role === "ai";
    if (data.seed && data.seed.trim() && onlyGreeting) {
      kicked.current = true;
      void send(data.seed.trim());
    } else if (onlyGreeting) {
      kicked.current = true; // 无 seed 也标记，避免重复判断
    }
  }, [data, send, promoted]);

  const hasUserMsg = !!data?.messages.some((m) => m.role === "user");

  const genOutline = React.useCallback(async () => {
    if (!data || outlineLoading || promotedRef.current) return;
    // 还没聊过（只有 AI 开场白）就点生成 → 友好提示去聊，不打会 400 的请求。
    if (!data.messages.some((m) => m.role === "user")) {
      toast("先在对话里说说你的想法，再生成故事大纲");
      switchPane("chat");
      window.setTimeout(() => chatInputRef.current?.focus(), 0);
      return;
    }
    // 已有大纲时重新生成会整份替换（包括手动改过的地方）：先问一句。
    if (data.outline) {
      const ok = await dramaConfirm({
        title: "重新生成故事大纲？",
        body: "会按现在的对话重写一份，这份大纲（包括你改过的标题、人物）会被替换。不花积分。",
        confirmLabel: "重新生成",
        cancelLabel: "先不了",
      });
      if (!ok) return;
    }
    setOutlineLoading(true);
    try {
      const { outline } = await BrainstormApi.generateOutline(id, data.messages);
      await flush({ ...data, outline });
      markFresh("outline", true);
    } catch (e) {
      toast.error(aiErrorMessage(e, "故事大纲没生成出来，多聊几句再试"));
    } finally {
      setOutlineLoading(false);
    }
  }, [data, id, outlineLoading, flush, markFresh, switchPane]);

  const goProduce = React.useCallback(async () => {
    if (!data?.outline || producing || promotedRef.current) return;
    setProducing(true);
    const form = data.settings.form;
    // 防抖里等着的那次保存不用再发：promote 会带着这份 data 一起落库。
    cancelPendingSave();
    try {
      // 带 data promote（后端先落库这份最新大纲 / 设置，再建）。
      // 幂等键按这段对话派生（promoteRequestId）：没收到响应再点、刷新后再点、两个标签页同时点，
      // 带的都是同一个键，服务端只建一条、只扣一笔开拍费。失败重试自然沿用同一个键。
      const result = await BrainstormApi.promote(id, form, data, { clientRequestId: promoteRequestId(id) });
      leaving.current = true;
      // 从这一刻起这段对话只读。缓存直接改成已去制作：按返回键回来时就是只读的样子，
      // 不会先露出一份还能改的旧草稿（在那上面改了，再点去制作拿回的还是这一条）。
      if (detail) {
        mutate(cacheKey, {
          meta: {
            ...detail.meta,
            status: "promoted",
            promotedKind: result.kind,
            promotedId: result.kind === "short" ? result.shortId : result.projectId,
          },
          data,
        });
      }
      if (result.kind === "short") {
        notifyWalletChanged();
        toast.success("短视频草稿建好了");
        router.push(`/shorts/make?draft=${encodeURIComponent(result.shortId)}`);
      } else {
        toast.success("短剧建好了，先看看故事大纲");
        router.push(`/projects/${result.projectId}`);
      }
    } catch (e) {
      setProducing(false);
      toast.error(aiErrorMessage(e, "没建成，请重试"));
      // 没建成，那份改动也就没跟着落库：补存一次（上面把等着的那次保存取消了）。
      void persist(data).catch(() => {});
    }
  }, [data, detail, id, cacheKey, producing, router, cancelPendingSave, persist]);

  // 已经去制作过：复制一份新对话（对话、大纲、设置原样带过去）接着改。新对话是新的草稿，
  // 去制作时是一次新的新建（单条短视频照常弹扣费确认），不会动已经建好的那一条。
  const [copying, setCopying] = React.useState(false);
  const copyAndEdit = React.useCallback(async () => {
    const src = detail?.data;
    if (!src || copying) return;
    setCopying(true);
    try {
      const fresh = await BrainstormApi.createBrainstorm();
      await BrainstormApi.saveBrainstorm(fresh.meta.id, { ...src, seed: null });
      toast.success("复制好了，改完再新建");
      const q = from === "projects" ? "&from=projects" : "";
      router.push(`/dashboard?b=${encodeURIComponent(fresh.meta.id)}${q}`);
    } catch (e) {
      setCopying(false);
      toast.error(aiErrorMessage(e, "没复制成，请重试"));
    }
  }, [detail, copying, from, router]);

  // 主按钮的扣费前置：单条短视频会扣 shortEntry 积分（后端 createShort），确认框走全站共享的 confirmShortStart；
  // 多集短剧新建不花积分，直接建。
  const confirmAndProduce = React.useCallback(async () => {
    if (!data?.outline || producing || promotedRef.current) return;
    if (data.settings.form === "single") {
      const ok = await confirmShortStart(cfg, SHORT_START_LEAD.fromOutline);
      if (!ok) return;
    }
    await goProduce();
  }, [data, producing, cfg, goProduce]);

  if (isLoading || (!data && !error)) {
    return <StudioLoading />;
  }
  if (error || !data || !detail) {
    return <StudioNotFound back={back} onBack={() => router.push(back.href)} />;
  }

  // 封存后显示服务端那一份（就是拿去制作的那份），不显示本页没存上的改动。
  const view: BrainstormData = promoted ? detail.data : data;
  const readOnly = !!promoted;
  const outline = view.outline;
  const form = view.settings.form;
  // 单条短视频一律竖屏 9:16（短视频制作页没有画幅选项），这里跟着显示，不让用户以为能改。
  const ratio = form === "single" ? SHORT_RATIO : view.settings.ratio;
  const metaLine = outline
    ? [outline.type, FORM_LABEL[form], RATIO_LABEL[ratio] ?? ratio, outline.tone].filter(Boolean).join("　·　")
    : "";
  const setForm = (k: BrainstormForm) => patch({ ...data, settings: { ...data.settings, form: k } });

  return (
    <div className="ws-flush col hm-bs-page" style={{ background: "var(--bg)" }}>
      <div className="row hm-bs-topbar" style={{ padding: "12px 24px 0", flex: "none", alignItems: "center", gap: 8 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.push(back.href)}>
          <ChevronLeft size={16} /> {back.label}
        </button>
        <span className="grow" />
        <SaveStatus status={saveStatus} />
      </div>

      <PaneTabs<Pane>
        className="hm-bs-pane-tabs"
        ariaLabel="切换对话和故事大纲"
        value={pane}
        onChange={switchPane}
        tabs={[
          { key: "chat", label: "对话", dot: freshPane === "chat" },
          { key: "outline", label: "故事大纲", dot: freshPane === "outline" },
        ]}
      />

      <div
        className="row gap-4 hm-bs-studio"
        data-pane={pane}
        style={{ flex: 1, minHeight: 0, alignItems: "stretch", padding: "12px 24px 24px", maxWidth: 1180, width: "100%", margin: "0 auto" }}
      >
        {/* 对话 */}
        <div
          className="col hm-bs-chat"
          style={{
            width: 368,
            flex: "none",
            borderRadius: 20,
            background: "var(--surface)",
            border: "1px solid var(--line-soft)",
            boxShadow: "0 22px 56px -26px color-mix(in oklch, var(--accent) 42%, transparent), 0 2px 10px rgba(20,10,50,.06)",
            overflow: "hidden",
            minHeight: 0,
          }}
        >
          <div className="row gap-3" style={{ padding: "13px 16px", borderBottom: "1px solid var(--line-soft)", flex: "none", alignItems: "center" }}>
            <span className="icon-badge" style={{ width: 30, height: 30, borderRadius: 9, flex: "none" }}>
              <Sparkles size={15} />
            </span>
            <div className="col" style={{ lineHeight: 1.25, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 14 }}>AI 故事助手</span>
              <span className="faint" style={{ fontSize: 11 }}>说说你的想法，AI 帮你理成故事大纲</span>
            </div>
          </div>
          <div ref={chatScrollRef} className="scroll col gap-3" style={{ padding: "18px 16px", flex: 1, minHeight: 0, background: "var(--bg)" }}>
            {view.messages.map((m, i) => (
              <ChatBubble key={i} m={m} onQuick={readOnly ? undefined : onQuick} />
            ))}
            {typing && (
              <div className="row" style={{ justifyContent: "flex-start" }}>
                <div className="row gap-1" style={{ padding: "13px 15px", borderRadius: 14, borderBottomLeftRadius: 5, background: "var(--surface-2)" }}>
                  <span className="typing-dot" />
                  <span className="typing-dot" style={{ animationDelay: ".16s" }} />
                  <span className="typing-dot" style={{ animationDelay: ".32s" }} />
                </div>
              </div>
            )}
          </div>
          {/* 窄屏：大纲在另一个页签里，这里给一个去那边的入口（桌面上大纲栏就在旁边，不显示） */}
          {hasUserMsg && (
            <div className="hm-bs-chat-cta" style={{ padding: "10px 14px", borderTop: "1px solid var(--line-soft)", flex: "none" }}>
              <button
                type="button"
                className="btn btn-line btn-sm"
                style={{ width: "100%", justifyContent: "center" }}
                disabled={outlineLoading}
                onClick={() => {
                  switchPane("outline");
                  if (!outline && !readOnly) void genOutline();
                }}
              >
                {outline ? (
                  <>
                    看故事大纲 <ArrowRight size={14} />
                  </>
                ) : (
                  <>
                    <Sparkles size={14} /> {outlineLoading ? "正在生成故事大纲…" : "聊得差不多了，生成故事大纲"}
                  </>
                )}
              </button>
            </div>
          )}
          {readOnly ? (
            <div
              className="muted"
              data-bs-readonly="chat"
              style={{ padding: "12px 16px", borderTop: "1px solid var(--line-soft)", flex: "none", fontSize: 12.5, lineHeight: 1.6 }}
            >
              这段对话已经拿去制作了，不能再接着聊。想换个方向，复制一份再聊。
            </div>
          ) : (
          <div className="row gap-2" style={{ padding: "12px 14px", borderTop: "1px solid var(--line-soft)", alignItems: "center", flex: "none" }}>
            <input
              ref={chatInputRef}
              className="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="说说你的想法，回车发送"
              style={{ flex: 1, minWidth: 0, height: 42, border: "1.5px solid var(--line)", borderRadius: 12, padding: "0 14px", fontSize: 14, background: "var(--surface-2)", outline: "none", color: "var(--ink)" }}
            />
            <button type="button" onClick={() => void send(input)} className="btn btn-grad btn-icon" style={{ width: 42, height: 42, flex: "none" }} aria-label="发送">
              <ArrowUp size={17} />
            </button>
          </div>
          )}
        </div>

        {/* 故事大纲 */}
        <div
          className="col grow hm-bs-outline"
          style={{ minWidth: 0, borderRadius: 20, background: "var(--surface)", border: "1px solid var(--line-soft)", boxShadow: "0 2px 10px rgba(20,10,50,.04)", overflow: "hidden", minHeight: 0 }}
        >
          <div className="row gap-3" style={{ padding: "13px 18px", borderBottom: "1px solid var(--line-soft)", flex: "none" }}>
            <ScrollText size={17} style={{ color: "var(--accent)", flex: "none" }} />
            <span style={{ fontWeight: 800, fontSize: 14, flex: "none", whiteSpace: "nowrap" }}>故事大纲</span>
            {(() => {
              const sub = readOnly
                ? "已经拿去制作了，这里只能看"
                : outlineLoading
                  ? "正在按对话整理…"
                  : outline
                    ? "哪里不对直接点开改，或者在对话里接着聊"
                    : "还没生成，不花积分";
              return (
                <span className="faint hm-bs-outline-sub" title={sub} style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sub}
                </span>
              );
            })()}
            {outline && !outlineLoading && !readOnly && (
              <button
                type="button"
                className="chip"
                style={{ flex: "none", fontSize: 11 }}
                onClick={() => void genOutline()}
                title="按现在的对话重写一份大纲，这份会被替换"
              >
                <RefreshCw size={12} /> 重新生成
              </button>
            )}
          </div>

          {!outline && !outlineLoading && (
            <div className="col center grow" style={{ padding: "30px 28px", textAlign: "center", gap: 15, minHeight: 0 }}>
              <span style={{ width: 60, height: 60, borderRadius: 18, background: "var(--surface-2)", border: "1.5px dashed var(--line)", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>
                <ScrollText size={27} />
              </span>
              <div className="col gap-1" style={{ maxWidth: 300 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>故事大纲会出现在这里</div>
                <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.65 }}>
                  聊得差不多了就点下面的按钮，AI 会把人物、剧情走向和主要场景整理到这里。不花积分。
                </div>
              </div>
              {!readOnly && (
                <button type="button" onClick={() => void genOutline()} className="btn btn-grad" style={{ height: 42, padding: "0 22px" }}>
                  <Sparkles size={16} /> 生成故事大纲
                </button>
              )}
            </div>
          )}

          {outlineLoading && <OutlineSkeleton />}

          {outline && !outlineLoading && (
            <>
              <div className="scroll grow gen-reveal hm-bs-outline-body" style={{ minHeight: 0, padding: "22px" }}>
                <div className="col" style={{ gap: 20 }}>
                  {/* 故事 */}
                  <div className="col gap-3">
                    <div className="faint" style={{ fontSize: 12 }}>{metaLine}</div>
                    <Field
                      readOnly={readOnly}
                      value={outline.title}
                      onCommit={(v) => patch({ ...data, outline: { ...outline, title: v } })}
                      block
                      style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.02em", lineHeight: 1.2 }}
                    />
                    <div style={{ borderLeft: "3px solid color-mix(in oklch, var(--accent) 45%, var(--line))", background: "var(--surface-2)", borderRadius: "0 10px 10px 0", padding: "9px 13px", marginTop: 2 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".04em", color: "var(--accent)", marginBottom: 5 }}>剧情走向</div>
                      <div style={{ fontSize: 12.5, lineHeight: 1.8, color: "var(--ink-2)" }}>{outline.beats.join("　→　")}</div>
                    </div>
                    <Field
                      readOnly={readOnly}
                      value={outline.logline}
                      onCommit={(v) => patch({ ...data, outline: { ...outline, logline: v } })}
                      block
                      style={{ fontSize: 14.5, lineHeight: 1.8, color: "var(--ink-2)" }}
                    />
                  </div>

                  <div style={{ height: 1, background: "var(--line-soft)" }} />

                  {/* 主要角色 —— 紧凑双列卡片（原先单列整行铺开太占空间） */}
                  <div className="col gap-3">
                    <SectionHead title="主要角色" hint={readOnly ? `${outline.roles.length} 位` : `${outline.roles.length} 位，点一下就能改`} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(228px, 100%), 1fr))", gap: 8 }}>
                      {outline.roles.map((r, i) => (
                        <div
                          key={i}
                          className="row gap-2"
                          style={{
                            alignItems: "center",
                            padding: "7px 10px 7px 7px",
                            borderRadius: 12,
                            background: "var(--surface-2)",
                            boxShadow: "inset 0 0 0 1px var(--line-soft)",
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              borderRadius: "50%",
                              background: "linear-gradient(135deg, color-mix(in oklch, var(--accent) 18%, #fff), color-mix(in oklch, var(--accent-2) 18%, #fff))",
                              boxShadow: "inset 0 0 0 1px var(--line)",
                              display: "grid",
                              placeItems: "center",
                              fontSize: 13,
                              fontWeight: 800,
                              color: "var(--accent-2)",
                              flex: "none",
                            }}
                          >
                            {r.name.slice(0, 1)}
                          </div>
                          <div className="col" style={{ minWidth: 0, gap: 1, lineHeight: 1.3 }}>
                            <Field
                      readOnly={readOnly}
                              value={r.name}
                              onCommit={(v) => patch({ ...data, outline: { ...outline, roles: outline.roles.map((x, j) => (j === i ? { ...x, name: v } : x)) } })}
                              block
                              style={{ fontSize: 13.5, fontWeight: 700 }}
                            />
                            <Field
                      readOnly={readOnly}
                              value={r.role}
                              onCommit={(v) => patch({ ...data, outline: { ...outline, roles: outline.roles.map((x, j) => (j === i ? { ...x, role: v } : x)) } })}
                              block
                              style={{ fontSize: 11.5, color: "var(--ink-3)" }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ height: 1, background: "var(--line-soft)" }} />

                  <div className="col gap-3">
                    <SectionHead title="主要场景" />
                    <div style={{ fontSize: 13.5, lineHeight: 1.9, color: "var(--ink-2)" }}>{outline.scenes.join("　·　")}</div>
                  </div>

                  <div style={{ height: 1, background: "var(--line-soft)" }} />

                  <div className="col gap-3">
                    <SectionHead title="画幅" />
                    {form === "single" ? (
                      <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                        短视频固定竖屏 9:16
                      </div>
                    ) : readOnly ? (
                      <div className="muted" style={{ fontSize: 13, lineHeight: 1.6 }}>
                        {RATIO_LABEL[ratio] ?? ratio}
                      </div>
                    ) : (
                      <Seg options={RATIOS} value={ratio} onChange={(k) => patch({ ...data, settings: { ...data.settings, ratio: k } })} />
                    )}
                  </div>
                </div>
              </div>

              {/* 底部：做成什么 + 主按钮（去向和花费就写在选项下面） */}
              {!readOnly && (
              <div className="hm-bs-cta" style={{ padding: "12px 18px 14px", borderTop: "1px solid var(--line-soft)", flex: "none" }}>
                <div className="row hm-bs-cta-row" style={{ gap: 12, alignItems: "center" }}>
                  <div className="row hm-bs-form-pick" role="radiogroup" aria-label="做成" style={{ gap: 8, flex: 1, minWidth: 0 }}>
                    <FormOption
                      on={form === "series"}
                      onClick={() => setForm("series")}
                      title="多集短剧"
                      sub="进「我的短剧」写分集剧情、逐集拆分镜，新建不花积分"
                    />
                    <FormOption
                      on={form === "single"}
                      onClick={() => setForm("single")}
                      title="单条短视频"
                      sub={`建一条短视频草稿，开始制作扣 ${cfg.prices.shortEntry} 积分`}
                    />
                  </div>
                  <button
                    type="button"
                    data-bs-action="produce"
                    onClick={() => void confirmAndProduce()}
                    disabled={producing}
                    className="btn btn-grad hm-bs-cta-main"
                    style={{ height: 44, padding: "0 20px", flex: "none" }}
                  >
                    {form === "single" ? <Zap size={15} /> : <Clapperboard size={15} />}
                    {producing ? "正在建…" : form === "single" ? "开始制作" : "新建短剧"}
                    {form === "single" && !producing && <CreditMark tone="inherit" size={15} />}
                  </button>
                </div>
              </div>
              )}
            </>
          )}

          {promoted && (
            <PromotedBar
              promoted={promoted}
              target={target}
              copying={copying}
              onOpen={() =>
                router.push(
                  promoted.kind === "short"
                    ? `/shorts/make?draft=${encodeURIComponent(promoted.id)}`
                    : `/projects/${encodeURIComponent(promoted.id)}`,
                )
              }
              onCopy={() => void copyAndEdit()}
              onTrash={() => router.push(promoted.kind === "short" ? "/trash?tab=shorts" : "/trash?tab=drama")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** 大纲里的一处文字：草稿时点开就能改；拿去制作之后只显示。 */
function Field({
  readOnly,
  value,
  onCommit,
  block,
  style,
}: {
  readOnly: boolean;
  value: string;
  onCommit: (v: string) => void;
  block?: boolean;
  style?: React.CSSProperties;
}) {
  if (readOnly) {
    return (
      <span data-bs-readonly="field" style={{ display: block ? "block" : "inline-block", overflowWrap: "anywhere", ...style }}>
        {value}
      </span>
    );
  }
  return <Editable value={value} onCommit={onCommit} block={block} style={style} />;
}

const KIND_NOUN: Record<Promoted["kind"], string> = { project: "短剧", short: "短视频" };
const KIND_MEASURE: Record<Promoted["kind"], string> = { project: "部", short: "条" };

/** 已经去制作过的对话：底部不再是「新建」，而是打开建好的那一条，或者复制一份接着改。 */
function PromotedBar({
  promoted,
  target,
  copying,
  onOpen,
  onCopy,
  onTrash,
}: {
  promoted: Promoted;
  target: TargetState;
  copying: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onTrash: () => void;
}) {
  const noun = KIND_NOUN[promoted.kind];
  const gone = target.state === "gone";
  const line =
    target.state === "ok"
      ? `这段对话已经建成${noun}《${target.title}》。要改故事就复制一份，改完再新建，建好的这${KIND_MEASURE[promoted.kind]}不受影响。`
      : gone
        ? `用这段对话建的那${KIND_MEASURE[promoted.kind]}${noun}已经删了，可能在回收站里。要接着做，复制一份再新建。`
        : `这段对话已经建成${noun}了。要改故事就复制一份，改完再新建。`;
  const copyBtn = (primary: boolean) => (
    <button
      type="button"
      data-bs-action="copy"
      onClick={onCopy}
      disabled={copying}
      className={`btn ${primary ? "btn-grad hm-bs-cta-main" : "btn-line hm-bs-cta-alt"}`}
      style={{ height: 44, padding: "0 18px", flex: "none" }}
    >
      <Copy size={15} /> {copying ? "正在复制…" : "复制一份接着改"}
    </button>
  );
  return (
    <div
      className="hm-bs-cta"
      data-bs-promoted={target.state}
      style={{ padding: "12px 18px 14px", borderTop: "1px solid var(--line-soft)", flex: "none" }}
    >
      <div className="row hm-bs-cta-row" style={{ gap: 10, alignItems: "center" }}>
        <div className="muted hm-bs-form-pick" style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.6, overflowWrap: "anywhere" }}>
          {line}
        </div>
        {gone ? (
          <>
            <button type="button" data-bs-action="trash" onClick={onTrash} className="btn btn-line hm-bs-cta-alt" style={{ height: 44, padding: "0 18px", flex: "none" }}>
              去回收站看看
            </button>
            {copyBtn(true)}
          </>
        ) : (
          <>
            {copyBtn(false)}
            <button
              type="button"
              data-bs-action="open"
              onClick={onOpen}
              disabled={target.state === "checking"}
              className="btn btn-grad hm-bs-cta-main"
              style={{ height: 44, padding: "0 20px", flex: "none" }}
            >
              打开{noun} <ArrowRight size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="row gap-2" style={{ alignItems: "center" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", flex: "none" }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", color: "var(--ink-3)" }}>{title}</span>
      {hint && <span className="faint" style={{ fontSize: 11 }}>{hint}</span>}
    </div>
  );
}

function FormOption({ on, onClick, title, sub }: { on: boolean; onClick: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className="col hm-bs-form-opt"
      title={sub}
      style={{
        flex: "1 1 0",
        minWidth: 0,
        gap: 2,
        textAlign: "left",
        padding: "8px 11px",
        borderRadius: 12,
        cursor: "pointer",
        background: on ? "var(--accent-soft)" : "var(--surface-2)",
        border: on ? "1.5px solid var(--accent)" : "1.5px solid transparent",
        color: "var(--ink)",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 700, color: on ? "var(--accent)" : "var(--ink-2)" }}>{title}</span>
      <span className="faint" style={{ fontSize: 11, lineHeight: 1.45 }}>{sub}</span>
    </button>
  );
}

function ChatBubble({ m, onQuick }: { m: BrainstormMessage; onQuick?: (q: string) => void }) {
  const mine = m.role === "user";
  return (
    <div className="row" style={{ justifyContent: mine ? "flex-end" : "flex-start" }}>
      <div className="col gap-2" style={{ maxWidth: "84%", minWidth: 0 }}>
        <div
          style={{
            padding: "11px 14px",
            borderRadius: 14,
            borderBottomLeftRadius: mine ? 14 : 5,
            borderBottomRightRadius: mine ? 5 : 14,
            background: mine ? "linear-gradient(135deg,var(--accent),var(--accent-2))" : "var(--surface-2)",
            color: mine ? "#fff" : "var(--ink)",
            fontSize: 13.5,
            lineHeight: 1.65,
            overflowWrap: "anywhere",
            ...(mine ? { whiteSpace: "pre-line" as const } : null),
          }}
        >
          {mine ? m.text : <MarkdownLite text={m.text} />}
        </div>
        {!mine && onQuick && m.quick && m.quick.length > 0 && (
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {m.quick.map((q, i) => (
              <button key={i} type="button" onClick={() => onQuick(q)} className="chip hm-bs-quick" style={{ background: "var(--accent-soft)", color: "var(--accent)", maxWidth: "100%" }}>
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Seg({ options, value, onChange }: { options: { k: string; label: string }[]; value: string; onChange: (k: string) => void }) {
  return (
    <div className="row" role="radiogroup" style={{ background: "var(--surface-2)", borderRadius: 10, padding: 3, gap: 2, flex: "none", flexWrap: "wrap", alignSelf: "flex-start", maxWidth: "100%" }}>
      {options.map((o) => {
        const on = value === o.k;
        return (
          <button
            key={o.k}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.k)}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              whiteSpace: "nowrap",
              background: on ? "var(--surface)" : "transparent",
              boxShadow: on ? "var(--shadow-sm)" : "none",
              color: on ? "var(--accent)" : "var(--ink-3)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function OutlineSkeleton() {
  return (
    <div className="col grow" style={{ padding: "24px 22px", gap: 18, minHeight: 0 }}>
      <div className="col center gap-3" style={{ padding: "6px 0 2px" }}>
        <span className="gen-pulse" style={{ width: 52, height: 52, borderRadius: "50%", background: "linear-gradient(135deg,var(--accent),var(--accent-2))", display: "grid", placeItems: "center", color: "#fff" }}>
          <Sparkles size={24} />
        </span>
        <div className="row gap-2" style={{ alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>正在生成故事大纲</span>
          <span className="row gap-1">
            <span className="typing-dot" />
            <span className="typing-dot" style={{ animationDelay: ".16s" }} />
            <span className="typing-dot" style={{ animationDelay: ".32s" }} />
          </span>
        </div>
      </div>
      <div className="col gap-2"><div className="skel" style={{ height: 13, width: "38%" }} /><div className="skel" style={{ height: 24, width: "72%" }} /></div>
      <div className="skel" style={{ height: 58, width: "100%" }} />
      <div className="col gap-2"><div className="skel" style={{ height: 13, width: "30%" }} /><div className="skel" style={{ height: 40, width: "100%" }} /><div className="skel" style={{ height: 40, width: "100%" }} /></div>
    </div>
  );
}

function StudioLoading() {
  return (
    <div className="ws-flush col center" style={{ gap: 14, background: "var(--bg)" }}>
      <span aria-hidden style={{ width: 34, height: 34, border: "3px solid var(--line)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "drama-spin .8s linear infinite" }} />
      <div className="muted" style={{ fontSize: 13 }}>正在加载…</div>
    </div>
  );
}

function StudioNotFound({ back, onBack }: { back: { label: string }; onBack: () => void }) {
  return (
    <div className="ws-flush col center" style={{ gap: 14, textAlign: "center", background: "var(--bg)", padding: "0 16px" }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>这段对话找不到了</h1>
      <div className="muted">可能已经删除，或者链接不完整。回去重新开始一段吧。</div>
      <button type="button" className="btn btn-line" onClick={onBack}>
        <ChevronLeft size={16} /> {back.label}
      </button>
    </div>
  );
}
