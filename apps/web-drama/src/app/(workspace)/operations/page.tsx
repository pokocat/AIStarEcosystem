"use client";

export const dynamic = "force-dynamic";

// 运营 · 热点与推荐（v0.67；v0.197 由「内容目录」改名）—— 维护首页的「近期热点 / 推荐点子」，
// 以及用户投稿到模板广场的模板审核。
// 仅平台运营（真实 operatorRole）可见可改；后端 /api/me/drama/catalog（写：OPERATOR/SUPER_ADMIN）。
// v0.197 第二轮：读目录走 getCatalog({ strict: true })。普通页面读失败回落平台默认没关系（只是看），
// 但这一页是要「发布」的 —— 读失败还拿默认值填编辑区，运营一点发布就把线上内容盖成默认（或者空）。
// 所以读失败 = 错误态 + 重试，并且在读到线上最新内容之前两个「发布」都禁用。
import * as React from "react";
import { toast } from "sonner";
import { AlertTriangle, Lightbulb, Plus, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import {
  generateHotspots,
  getCatalog,
  invalidateCatalog,
  resetCatalog,
  saveCatalog,
  type CatalogField,
  type HotTopic,
} from "@/api/catalog";
import type { IdeaRec } from "@/mocks/drama-workshop";
import { RecipeReviewSection } from "@/components/drama-workshop/recipe-review-section";
import { ViewHeader } from "@/components/common";
import { dramaConfirm } from "@/components/drama-ui";
import { hotTopicLabel } from "@/lib/hot-topic-label";

export default function OperationsPage() {
  const { user } = useAuth();
  const isOperator = !!user?.operatorRole; // 真实运营身份（operator / super_admin）

  const [hotTopics, setHotTopics] = React.useState<HotTopic[]>([]);
  const [ideas, setIdeas] = React.useState<IdeaRec[]>([]);
  const [loading, setLoading] = React.useState(true);
  /** 最近一次读目录失败的说明；非 null = 手上的内容不是线上最新的，不许发布。 */
  const [error, setError] = React.useState<string | null>(null);
  /** 至少成功读到过一次线上内容。没读到过时编辑区整个不出（里面只会是空的或默认值）。 */
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const publishBlocked = error !== null || loading;
  const publishBlockedReason = loading
    ? "正在读线上的内容，读完才能发布"
    : "没读到线上最新的内容，点上面「重试」读到之后才能发布";
  const [saving, setSaving] = React.useState<"hotTopics" | "ideas" | null>(null);
  const [genningHot, setGenningHot] = React.useState(false);
  // 未发布修改跟踪：热点/点子都是纯本地态，各自独立「发布」才落库。两区各存一份「已发布快照」，
  // 分别比对判定脏 —— 发布 A 区只重置 A 区基线，不会把 B 区未发布改动误标为已保存。
  const [savedHotSnapshot, setSavedHotSnapshot] = React.useState<string | null>(null);
  const [savedIdeasSnapshot, setSavedIdeasSnapshot] = React.useState<string | null>(null);
  const hotSnapshot = (h: HotTopic[]) => JSON.stringify(h);
  const ideasSnapshot = (i: IdeaRec[]) => JSON.stringify(i);
  const dirtyHot = savedHotSnapshot !== null && hotSnapshot(hotTopics) !== savedHotSnapshot;
  const dirtyIdeas = savedIdeasSnapshot !== null && ideasSnapshot(ideas) !== savedIdeasSnapshot;
  const dirty = dirtyHot || dirtyIdeas;

  // beforeunload 兜底：有未发布修改时，刷新/关页/离开给浏览器原生二次确认（做不到路由级拦截，
  // 但配合页面内黄条提示已能防误丢）。
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // AI 挑一批热点：抓抖音热搜 → 挑出适合拍短剧的话题 → 追加为可编辑行（改完再「发布」）。
  const genHot = async () => {
    if (genningHot) return;
    setGenningHot(true);
    try {
      const cands = await generateHotspots(12);
      if (!cands.length) {
        toast("这次没挑出适合拍短剧的话题，换个时间再试");
        return;
      }
      // 去重后真正加进去的条数（toast 里的数要和列表里多出来的一致）
      const seen = new Set(hotTopics.map((h) => h.idea.trim()).filter(Boolean));
      const add = cands
        .map((c) => c.trim())
        .filter((c, i, arr) => c && !seen.has(c) && arr.indexOf(c) === i)
        .map((c) => ({ label: hotTopicLabel(c), idea: c }));
      if (!add.length) {
        toast("挑出来的话题下面都已经有了");
        return;
      }
      setHotTopics((arr) => [...arr, ...add]);
      toast.success(`新加了 ${add.length} 条，改好后点「发布」才会上首页`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "没挑出来，请稍后重试");
    } finally {
      setGenningHot(false);
    }
  };

  /** 读一次最新目录（先清掉 getCatalog 的进程内缓存，否则「重新加载」拿到的还是旧值）。
   *  strict：读失败直接抛，不回落平台默认 —— 见文件头。 */
  const fetchFresh = React.useCallback(async () => {
    invalidateCatalog();
    return getCatalog({ strict: true });
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await fetchFresh();
      const h = c.hotTopics.map((x) => ({ ...x }));
      const i = c.ideas.map((x) => ({ ...x }));
      setHotTopics(h);
      setIdeas(i);
      setSavedHotSnapshot(hotSnapshot(h));
      setSavedIdeasSnapshot(ideasSnapshot(i));
      setLoadedOnce(true);
    } catch (e) {
      setError(readFailureText(e));
    } finally {
      setLoading(false);
    }
  }, [fetchFresh]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const reload = async () => {
    if (dirty) {
      const ok = await dramaConfirm({
        title: "丢掉没发布的修改？",
        body: "重新加载会换回线上现在的内容，你在这一页改了但还没点「发布」的地方都会丢掉。",
        confirmLabel: "重新加载",
        cancelLabel: "先不加载",
        tone: "danger",
      });
      if (!ok) return;
    }
    await load();
  };

  // 恢复默认：只动这一区，另一区没发布的修改保留。
  const revert = async (field: "hotTopics" | "ideas", label: string) => {
    const ok = await dramaConfirm({
      title: `把「${label}」恢复成平台默认？`,
      body: `首页的「${label}」会换回平台默认内容，马上对所有用户生效，你之前发布的这一区内容会被替换，没法撤回。`,
      confirmLabel: "恢复默认",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await resetCatalog(field as CatalogField);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "恢复失败，请重试");
      return;
    }
    // 恢复已经生效；接着读一次线上内容。读不到就进错误态（不许发布），别把它说成「恢复失败」。
    try {
      const c = await fetchFresh();
      if (field === "hotTopics") {
        const h = c.hotTopics.map((x) => ({ ...x }));
        setHotTopics(h);
        setSavedHotSnapshot(hotSnapshot(h));
      } else {
        const i = c.ideas.map((x) => ({ ...x }));
        setIdeas(i);
        setSavedIdeasSnapshot(ideasSnapshot(i));
      }
      setError(null);
      toast.success(`「${label}」已恢复成平台默认`);
    } catch (e) {
      setError(readFailureText(e));
      toast(`「${label}」已恢复成平台默认，但没读到最新内容，点「重试」再读一次`);
    }
  };

  const saveHot = async () => {
    if (publishBlocked) return; // 按钮已禁用；这里再挡一次，读不到线上内容时绝不发布
    const clean = hotTopics.filter((h) => h.label.trim() || h.idea.trim());
    setSaving("hotTopics");
    try {
      await saveCatalog("hotTopics", clean);
      const cleaned = clean.map((h) => ({ ...h }));
      setHotTopics(cleaned);
      setSavedHotSnapshot(hotSnapshot(cleaned));
      toast.success(`已发布「近期热点」${clean.length} 条，所有用户的首页马上更新`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发布失败，请重试");
    } finally {
      setSaving(null);
    }
  };
  const saveIdeas = async () => {
    if (publishBlocked) return;
    const clean = ideas.filter((i) => i.title.trim() || i.hook.trim());
    setSaving("ideas");
    try {
      await saveCatalog("ideas", clean);
      const cleaned = clean.map((i) => ({ ...i }));
      setIdeas(cleaned);
      setSavedIdeasSnapshot(ideasSnapshot(cleaned));
      toast.success(`已发布「推荐点子」${clean.length} 条，所有用户的首页马上更新`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发布失败，请重试");
    } finally {
      setSaving(null);
    }
  };

  if (!isOperator) {
    return (
      <div className="col center" style={{ height: "100%", gap: 12, textAlign: "center", padding: "0 8px" }}>
        <div className="icon-badge" style={{ width: 52, height: 52, borderRadius: 16 }}>
          <Sparkles size={26} />
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>只有平台运营能打开这一页</h1>
        <div className="muted" style={{ maxWidth: 360 }}>
          首页的近期热点和推荐点子由平台运营维护，你的账号没有运营权限。
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <ViewHeader
          eyebrow="运营"
          title={
            <>
              热点与{" "}
              <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
                推荐
              </span>
            </>
          }
          meta="改首页的「近期热点」和「推荐点子」，点各区的「发布」后所有用户马上能看到"
          action={
            <button type="button" className="btn btn-line btn-sm" data-ops-reload disabled={loading} onClick={() => void reload()}>
              <RefreshCw size={14} /> 重新加载
            </button>
          }
        />
      </div>

      {dirty && (
        <div
          className="row gap-2"
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(245,158,11,.14)",
            border: "1px solid rgba(245,158,11,.35)",
            color: "#b45309",
            fontSize: 13,
            fontWeight: 600,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={15} style={{ flex: "none", marginTop: 2 }} />
          <span style={{ minWidth: 0 }}>
            有没发布的修改{dirtyHot && dirtyIdeas ? "（两区都有）" : dirtyHot ? "（近期热点）" : "（推荐点子）"}，离开或刷新前记得点那一区的「发布」。
          </span>
        </div>
      )}

      {/* 读到过、这次没读到：编辑区保留上次读到的内容，但发布禁用 */}
      {error && loadedOnce && !loading && (
        <div className="acct-ops-read-failed" role="alert" data-ops-read-failed="stale">
          <AlertTriangle size={15} style={{ flex: "none", marginTop: 2 }} />
          <span className="acct-ops-read-failed-text">
            刚才没读到线上最新的内容（{error}）。下面是上次读到的，读到最新的之前不能发布。
          </span>
          <button type="button" className="btn btn-line btn-sm" onClick={() => void reload()}>
            <RefreshCw size={14} /> 重试
          </button>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <span className="muted">正在读线上的内容…</span>
        </div>
      ) : error && !loadedOnce ? (
        // 一次都没读到：不出编辑区（里面只会是空的，看着像「线上一条都没有」，一发布就真清空了）
        <div className="col gap-6">
          <div className="card acct-ops-load-failed" role="alert" data-ops-read-failed="never-loaded">
            <div className="icon-badge" style={{ width: 44, height: 44, borderRadius: 14 }}>
              <AlertTriangle size={22} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>没读到线上的热点和推荐点子</div>
            <div className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, maxWidth: 440 }}>
              {error}。读到之前热点和推荐点子都不能发布，免得拿平台默认内容把线上的盖掉。
            </div>
            <button type="button" className="btn btn-grad btn-sm" onClick={() => void reload()}>
              <RefreshCw size={14} /> 重试
            </button>
          </div>

          <RecipeReviewSection />
        </div>
      ) : (
        <div className="col gap-6">
          {/* 近期热点 */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="acct-ops-head">
              <span className="acct-ops-head-title">
                <Sparkles size={16} style={{ color: "var(--accent)" }} />
                近期热点
              </span>
              <span className="acct-ops-head-sub">
                首页、新建短剧和新建短视频输入框里的热点标签 · {hotTopics.length} 条
                {error && <span className="acct-ops-head-blocked"> · 暂时不能发布</span>}
              </span>
              <div className="acct-ops-head-actions">
                <button
                  type="button"
                  className="btn btn-line btn-sm"
                  disabled={genningHot}
                  onClick={() => void genHot()}
                  title="从抖音热搜里挑出适合拍短剧的话题，加到下面，你改完再发布"
                >
                  <Sparkles size={14} /> {genningHot ? "正在挑…" : "从热搜挑一批"}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revert("hotTopics", "近期热点")}>恢复默认</button>
                <button
                  type="button"
                  className="btn btn-grad btn-sm"
                  data-ops-publish="hotTopics"
                  disabled={publishBlocked || saving === "hotTopics"}
                  title={publishBlocked ? publishBlockedReason : "发布后所有用户的首页马上更新"}
                  onClick={() => void saveHot()}
                >
                  <Save size={14} /> {saving === "hotTopics" ? "发布中…" : "发布"}
                </button>
              </div>
            </div>
            <div className="col gap-2" style={{ padding: 16 }}>
              {hotTopics.length === 0 && (
                <span className="faint" style={{ fontSize: 13 }}>还没有热点。点「从热搜挑一批」，或者自己加一条。</span>
              )}
              {hotTopics.map((h, i) => (
                <div key={i} className="acct-ops-hot-row">
                  <input
                    value={h.label}
                    aria-label="短标签"
                    placeholder="短标签（如：世界杯看台被拍）"
                    onChange={(e) => setHotTopics((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    className="acct-ops-hot-label"
                    style={inputStyle()}
                  />
                  <input
                    value={h.idea}
                    aria-label="完整点子"
                    placeholder="用户点这个标签后，填进输入框的完整点子"
                    onChange={(e) => setHotTopics((arr) => arr.map((x, j) => (j === i ? { ...x, idea: e.target.value } : x)))}
                    className="acct-ops-hot-idea"
                    style={inputStyle()}
                  />
                  <button type="button" className="btn btn-icon btn-ghost btn-sm" title="删除这条" aria-label="删除这条" onClick={() => setHotTopics((arr) => arr.filter((_, j) => j !== i))}>
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setHotTopics((arr) => [...arr, { label: "", idea: "" }])}>
                <Plus size={14} /> 加一条热点
              </button>
            </div>
          </div>

          {/* 推荐点子 */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="acct-ops-head">
              <span className="acct-ops-head-title">
                <Lightbulb size={16} style={{ color: "var(--accent)" }} />
                推荐点子
              </span>
              <span className="acct-ops-head-sub">
                首页的推荐卡片 · {ideas.length} 条
                {error && <span className="acct-ops-head-blocked"> · 暂时不能发布</span>}
              </span>
              <div className="acct-ops-head-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revert("ideas", "推荐点子")}>恢复默认</button>
                <button
                  type="button"
                  className="btn btn-grad btn-sm"
                  data-ops-publish="ideas"
                  disabled={publishBlocked || saving === "ideas"}
                  title={publishBlocked ? publishBlockedReason : "发布后所有用户的首页马上更新"}
                  onClick={() => void saveIdeas()}
                >
                  <Save size={14} /> {saving === "ideas" ? "发布中…" : "发布"}
                </button>
              </div>
            </div>
            <div className="col gap-3" style={{ padding: 16 }}>
              {ideas.length === 0 && (
                <span className="faint" style={{ fontSize: 13 }}>还没有推荐点子，点下面「加一条点子」。</span>
              )}
              {ideas.map((r, i) => (
                <div key={i} className="card" style={{ padding: 12, background: "var(--surface-2)", border: "none" }}>
                  <div className="acct-ops-idea-row">
                    <input
                      value={r.cat}
                      aria-label="题材"
                      placeholder="题材（悬疑 / 甜宠 …）"
                      onChange={(e) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, cat: e.target.value } : x)))}
                      className="acct-ops-idea-cat"
                      style={inputStyle()}
                    />
                    <input
                      value={r.title}
                      aria-label="标题"
                      placeholder="标题"
                      onChange={(e) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                      className="acct-ops-idea-title"
                      style={inputStyle()}
                    />
                    <div className="acct-ops-idea-tools">
                      <label
                        className="row gap-1 faint"
                        style={{ fontSize: 11.5, flex: "none", whiteSpace: "nowrap" }}
                        title="讲用户自己经历的点子。勾上后不会被「随机来一个」抽到"
                      >
                        <input type="checkbox" checked={!!r.personal} onChange={(e) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, personal: e.target.checked } : x)))} />
                        个人经历类
                      </label>
                      <span className="grow" />
                      <ColorDot label="卡片渐变起始色" value={r.from} onChange={(v) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, from: v } : x)))} />
                      <ColorDot label="卡片渐变结束色" value={r.to} onChange={(v) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, to: v } : x)))} />
                      <button type="button" className="btn btn-icon btn-ghost btn-sm" title="删除这条" aria-label="删除这条" onClick={() => setIdeas((arr) => arr.filter((_, j) => j !== i))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={r.hook}
                    aria-label="一句话钩子"
                    placeholder="一句话钩子（用户点卡片后填进输入框）"
                    rows={2}
                    onChange={(e) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, hook: e.target.value } : x)))}
                    style={{ ...inputStyle(), width: "100%", height: "auto", padding: "8px 10px", resize: "vertical", fontFamily: "inherit" }}
                  />
                </div>
              ))}
              <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setIdeas((arr) => [...arr, { cat: "", title: "", hook: "", from: "#f97316", to: "#e11d48" }])}>
                <Plus size={14} /> 加一条点子
              </button>
            </div>
          </div>

          {/* 模板审核（v0.73/v0.75）—— 用户投稿到模板广场的模板在此审核 / 上架 / 驳回 */}
          <RecipeReviewSection />

          <div className="muted" style={{ fontSize: 12.5, padding: "0 2px", lineHeight: 1.6 }}>
            要新建官方模板，或从用户作品里挑模板上架，去「模板广场」。这里只审核用户自己投稿的模板。
          </div>
        </div>
      )}
    </div>
  );
}

/** 读目录失败时给运营看的原因（不带句末标点，调用处自己接）。
 *  服务端给的中文说明（如没有权限）原样用；网络断、HTTP 状态码、英文信封报错这类不给人看，换成一句通用的。 */
function readFailureText(e: unknown): string {
  const raw = (e instanceof Error ? e.message : typeof e === "string" ? e : "").trim();
  const readable = /[\u4e00-\u9fa5]/.test(raw) && !/HTTP\s*\d{3}/.test(raw);
  return readable ? raw.replace(/[。.！!]+$/u, "") : "可能是网络不稳，或者服务暂时出了问题";
}

function inputStyle(): React.CSSProperties {
  return {
    minWidth: 0,
    height: 34,
    border: "1.5px solid var(--line)",
    borderRadius: 9,
    padding: "0 10px",
    fontSize: 13,
    outline: "none",
    background: "var(--surface)",
    color: "var(--ink)",
  };
}

function ColorDot({ value, label, onChange }: { value: string; label: string; onChange: (v: string) => void }) {
  return (
    <label
      title={`${label}：${value}`}
      style={{ width: 24, height: 24, borderRadius: 7, background: value, flex: "none", cursor: "pointer", border: "1px solid var(--line)", position: "relative", overflow: "hidden" }}
    >
      <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
    </label>
  );
}
