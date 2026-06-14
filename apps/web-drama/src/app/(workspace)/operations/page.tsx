"use client";

export const dynamic = "force-dynamic";

// 运营 · 短剧内容目录（v0.67）—— 维护平台提供的「近期热点 / 创意推荐」（后续可扩模板等）。
// 仅平台运营（真实 operatorRole）可见可改；后端 /api/me/drama/catalog（写：OPERATOR/SUPER_ADMIN）。
import * as React from "react";
import { toast } from "sonner";
import { Lightbulb, Plus, RefreshCw, Save, Sparkles, Trash2, X } from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { getCatalog, resetCatalog, saveCatalog, type CatalogField, type HotTopic } from "@/api/catalog";
import type { IdeaRec } from "@/mocks/drama-workshop";
import { RecipeReviewSection } from "@/components/drama-workshop/recipe-review-section";

export default function OperationsPage() {
  const { user } = useAuth();
  const isOperator = !!user?.operatorRole; // 真实运营身份（operator / super_admin）

  const [hotTopics, setHotTopics] = React.useState<HotTopic[]>([]);
  const [ideas, setIdeas] = React.useState<IdeaRec[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<"hotTopics" | "ideas" | null>(null);

  const revert = async (field: CatalogField, label: string) => {
    try {
      await resetCatalog(field);
      await load();
      toast.success(`「${label}」已恢复为平台默认`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "恢复失败，请重试");
    }
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const c = await getCatalog();
      setHotTopics(c.hotTopics.map((h) => ({ ...h })));
      setIdeas(c.ideas.map((i) => ({ ...i })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "目录加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const saveHot = async () => {
    const clean = hotTopics.filter((h) => h.label.trim() || h.idea.trim());
    setSaving("hotTopics");
    try {
      await saveCatalog("hotTopics", clean);
      setHotTopics(clean.map((h) => ({ ...h })));
      toast.success(`已发布「近期热点」（${clean.length} 条），全站首页即时生效`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(null);
    }
  };
  const saveIdeas = async () => {
    const clean = ideas.filter((i) => i.title.trim() || i.hook.trim());
    setSaving("ideas");
    try {
      await saveCatalog("ideas", clean);
      setIdeas(clean.map((i) => ({ ...i })));
      toast.success(`已发布「创意推荐」（${clean.length} 条），全站首页即时生效`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存失败，请重试");
    } finally {
      setSaving(null);
    }
  };

  if (!isOperator) {
    return (
      <div className="col center" style={{ height: "100%", gap: 12, textAlign: "center" }}>
        <div className="icon-badge" style={{ width: 52, height: 52, borderRadius: 16 }}>
          <Sparkles size={26} />
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>仅平台运营可访问</h1>
        <div className="muted" style={{ maxWidth: 360 }}>
          短剧内容目录（首页热点 / 创意推荐等）由平台运营维护。你的账号没有运营权限。
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 22, gap: 12 }}>
        <div className="grow">
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>运营 · 内容目录</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            维护平台提供的「近期热点 / 创意推荐」—— 改完发布，全站首页即时生效
          </div>
        </div>
        <button type="button" className="btn btn-line btn-sm" disabled={loading} onClick={() => void load()}>
          <RefreshCw size={14} /> 重新加载
        </button>
      </div>

      {error && (
        <div className="card row" style={{ padding: 16, marginBottom: 18, gap: 12, justifyContent: "space-between" }}>
          <span className="muted" style={{ fontSize: 13.5 }}>{error}</span>
          <button type="button" className="btn btn-line btn-sm" onClick={() => void load()}>重试</button>
        </div>
      )}

      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: "center" }}>
          <span className="muted">正在加载内容目录…</span>
        </div>
      ) : (
        <div className="col gap-6">
          {/* 近期热点 */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="row gap-2" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)" }}>
              <Sparkles size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 800, fontSize: 15 }}>近期热点</span>
              <span className="faint" style={{ fontSize: 12 }}>首页对话框上方的热点 chips · {hotTopics.length} 条</span>
              <span className="grow" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revert("hotTopics", "近期热点")}>恢复默认</button>
              <button type="button" className="btn btn-grad btn-sm" disabled={saving === "hotTopics"} onClick={() => void saveHot()}>
                <Save size={14} /> {saving === "hotTopics" ? "发布中…" : "发布"}
              </button>
            </div>
            <div className="col gap-2" style={{ padding: 16 }}>
              {hotTopics.map((h, i) => (
                <div key={i} className="row gap-2" style={{ alignItems: "center" }}>
                  <input
                    value={h.label}
                    placeholder="短标签（如：世界杯看台被拍）"
                    onChange={(e) => setHotTopics((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                    style={inputStyle(180)}
                  />
                  <input
                    value={h.idea}
                    placeholder="点击后填入对话框的完整点子"
                    onChange={(e) => setHotTopics((arr) => arr.map((x, j) => (j === i ? { ...x, idea: e.target.value } : x)))}
                    style={{ ...inputStyle(0), flex: 1 }}
                  />
                  <button type="button" className="btn btn-icon btn-ghost btn-sm" title="删除" onClick={() => setHotTopics((arr) => arr.filter((_, j) => j !== i))}>
                    <X size={15} />
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setHotTopics((arr) => [...arr, { label: "", idea: "" }])}>
                <Plus size={14} /> 加一条热点
              </button>
            </div>
          </div>

          {/* 创意推荐 */}
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="row gap-2" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)" }}>
              <Lightbulb size={16} style={{ color: "var(--accent)" }} />
              <span style={{ fontWeight: 800, fontSize: 15 }}>创意推荐</span>
              <span className="faint" style={{ fontSize: 12 }}>首页封面式推荐卡 · {ideas.length} 条</span>
              <span className="grow" />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => void revert("ideas", "创意推荐")}>恢复默认</button>
              <button type="button" className="btn btn-grad btn-sm" disabled={saving === "ideas"} onClick={() => void saveIdeas()}>
                <Save size={14} /> {saving === "ideas" ? "发布中…" : "发布"}
              </button>
            </div>
            <div className="col gap-3" style={{ padding: 16 }}>
              {ideas.map((r, i) => (
                <div key={i} className="card" style={{ padding: 12, background: "var(--surface-2)", border: "none" }}>
                  <div className="row gap-2" style={{ marginBottom: 8 }}>
                    <input
                      value={r.cat}
                      placeholder="题材（悬疑 / 甜宠 …）"
                      onChange={(e) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, cat: e.target.value } : x)))}
                      style={inputStyle(120)}
                    />
                    <input
                      value={r.title}
                      placeholder="标题"
                      onChange={(e) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                      style={{ ...inputStyle(0), flex: 1 }}
                    />
                    <label className="row gap-1 faint" style={{ fontSize: 11.5, flex: "none", whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={!!r.personal} onChange={(e) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, personal: e.target.checked } : x)))} />
                      个性化
                    </label>
                    <ColorDot value={r.from} onChange={(v) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, from: v } : x)))} />
                    <ColorDot value={r.to} onChange={(v) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, to: v } : x)))} />
                    <button type="button" className="btn btn-icon btn-ghost btn-sm" title="删除" onClick={() => setIdeas((arr) => arr.filter((_, j) => j !== i))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <textarea
                    value={r.hook}
                    placeholder="一句话钩子（点击推荐卡后填入对话框）"
                    rows={2}
                    onChange={(e) => setIdeas((arr) => arr.map((x, j) => (j === i ? { ...x, hook: e.target.value } : x)))}
                    style={{ ...inputStyle(0), width: "100%", resize: "vertical", fontFamily: "inherit" }}
                  />
                </div>
              ))}
              <button type="button" className="btn btn-line btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => setIdeas((arr) => [...arr, { cat: "", title: "", hook: "", from: "#f97316", to: "#e11d48" }])}>
                <Plus size={14} /> 加一条创意
              </button>
            </div>
          </div>

          {/* 创意审核（v0.73/v0.75）—— 用户自助发布到创意市场的创意在此审核 / 发布 / 驳回 */}
          <RecipeReviewSection />

          <div className="muted" style={{ fontSize: 12.5, padding: "0 2px" }}>
            注:运营「新建内置创意 / 从用户作品精选」入口在「创意市场」页;此处为用户自助发布的审核队列。
          </div>
        </div>
      )}
    </div>
  );
}

function inputStyle(width: number): React.CSSProperties {
  return {
    width: width || undefined,
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

function ColorDot({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label
      title={value}
      style={{ width: 24, height: 24, borderRadius: 7, background: value, flex: "none", cursor: "pointer", border: "1px solid var(--line)", position: "relative", overflow: "hidden" }}
    >
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
    </label>
  );
}
