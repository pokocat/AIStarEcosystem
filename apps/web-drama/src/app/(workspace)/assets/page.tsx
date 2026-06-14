"use client";

export const dynamic = "force-dynamic";

// 素材库 — 设计真源 screens-hub-v2.jsx `AssetsHub` / `MaterialCard` / `MaterialDetail` / `MaterialUpload`:
// 自由上传图片 / 视频,用标签区分人物 / 场景 / 道具 —— 生成时 @ 进来作参考。
import * as React from "react";
import {
  Check,
  Film,
  Image as ImageIcon,
  Layers,
  Package,
  Play,
  Plus,
  Search,
  Sparkles,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Thumb } from "@/components/drama-ui";
import {
  ASSET_USAGE,
  MAT_CATS,
  MATERIALS,
  setMaterials,
  type Material,
} from "@/mocks/drama-workshop";

const CAT_TAG: Record<string, string> = {
  人物: "tag-pink",
  场景: "tag-accent",
  道具: "tag-gray",
  其他: "tag-gray",
};

const CAT_ICONS: Record<string, React.ElementType> = {
  人物: User,
  场景: ImageIcon,
  道具: Package,
  其他: Layers,
};

const ASSET_PALETTES: [string, string][] = [
  ["#a78bfa", "#f0abfc"],
  ["#60a5fa", "#22d3ee"],
  ["#f472b6", "#fda4af"],
  ["#f59e0b", "#fb7185"],
  ["#10b981", "#22d3ee"],
  ["#64748b", "#1e293b"],
];

type MediaFilter = "all" | "image" | "video";
const STORAGE_KEY = "aistareco.web-drama.assets.v1";

function cloneMaterials(list: Material[]): Material[] {
  return list.map((m) => ({ ...m, tags: [...(m.tags ?? [])] }));
}

function loadInitialMaterials(): Material[] {
  if (typeof window === "undefined") return cloneMaterials(MATERIALS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Material[];
      if (Array.isArray(parsed)) return cloneMaterials(parsed);
    }
  } catch {
    // 本地缓存损坏时回退到内置素材池。
  }
  return cloneMaterials(MATERIALS);
}

function persistMaterials(next: Material[]) {
  const snapshot = cloneMaterials(next);
  setMaterials(snapshot);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // 存储失败不阻塞当前会话的素材操作。
  }
}

export default function AssetsPage() {
  // 暂无后端资产表：浏览器本地持久化 + 内置素材池兜底，避免刷新 / 重启后空库。
  const [items, setItems] = React.useState<Material[]>(loadInitialMaterials);
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState("all"); // all / 人物 / 场景 / 道具 / 其他
  const [media, setMedia] = React.useState<MediaFilter>("all"); // all / image / video
  const [sel, setSel] = React.useState<Material | null>(null);
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => {
    setMaterials(items);
  }, [items]);

  const sync = (next: Material[]) => {
    const snapshot = cloneMaterials(next);
    persistMaterials(snapshot);
    setItems(snapshot);
  };
  const create = (m: Material) => {
    sync([m, ...items]);
    setAdding(false);
    toast.success(`已上传素材「${m.name}」`);
  };
  const save = (id: string, patch: Partial<Material>) => {
    const next = items.map((a) => (a.id === id ? { ...a, ...patch } : a));
    sync(next);
    setSel((s2) => (s2 ? { ...s2, ...patch } : s2));
    toast.success("修改已保存");
  };
  const remove = (id: string) => {
    sync(items.filter((a) => a.id !== id));
    setSel(null);
    toast.success("已删除,关联项目不受影响");
  };

  const list = items.filter(
    (a) =>
      (cat === "all" || a.cat === cat) &&
      (media === "all" || a.kind === media) &&
      (!q || a.name.includes(q) || (a.tags || []).some((t) => t.includes(q)) || a.cat.includes(q)),
  );
  const catCount = (k: string) => items.filter((a) => a.cat === k).length;

  const mediaTabs: { key: MediaFilter; label: string }[] = [
    { key: "all", label: "全部" },
    { key: "image", label: "图片" },
    { key: "video", label: "视频" },
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>素材库</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            自由上传图片 / 视频,用标签区分人物、场景、道具 —— 生成时 @ 进来作参考
          </div>
        </div>
        <div className="grow"></div>
        <button className="btn btn-grad" style={{ height: 42 }} onClick={() => setAdding(true)}>
          <Plus size={15} /> 上传素材
        </button>
      </div>

      {/* 查:搜索 + 类型标签 + 媒体类型 */}
      <div className="row gap-2" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <div className="row card" style={{ padding: "0 13px", height: 38, width: 240, gap: 8, borderRadius: 999 }}>
          <Search size={15} style={{ color: "var(--ink-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜名称 / 标签…"
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 13 }}
          />
        </div>
        <span className="grow"></span>
        <div className="row" style={{ background: "var(--surface-2)", borderRadius: 999, padding: 3, gap: 2, flex: "none" }}>
          {mediaTabs.map(({ key, label }) => (
            <button
              key={key}
              className="chip"
              onClick={() => setMedia(key)}
              style={{
                height: 28,
                background: media === key ? "var(--surface)" : "transparent",
                color: media === key ? "var(--accent)" : "var(--ink-3)",
                boxShadow: media === key ? "var(--shadow-sm)" : "none",
              }}
            >
              {key === "video" && <Play size={11} />}
              {key === "image" && <ImageIcon size={11} />}
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="row gap-2" style={{ marginBottom: 22, flexWrap: "wrap" }}>
        <button className={"chip num" + (cat === "all" ? " on" : "")} onClick={() => setCat("all")}>
          全部 · {items.length}
        </button>
        {MAT_CATS.map((c) => {
          const Icon = CAT_ICONS[c.key] ?? Layers;
          return (
            <button key={c.key} className={"chip num" + (cat === c.key ? " on" : "")} onClick={() => setCat(c.key)}>
              <Icon size={12} /> {c.key} · {catCount(c.key)}
            </button>
          );
        })}
      </div>

      {list.length === 0 && (
        <div className="card col center" style={{ padding: "46px 0", gap: 12, color: "var(--ink-3)" }}>
          <div style={{ width: 50, height: 50, borderRadius: 15, background: "var(--surface-2)", display: "grid", placeItems: "center" }}>
            <ImageIcon size={24} />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{q || cat !== "all" || media !== "all" ? "没有匹配的素材" : "素材库还是空的 —— 上传图片 / 视频建素材"}</span>
          <button className="btn btn-line btn-sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> 上传一个
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(172px,1fr))", gap: 14, alignItems: "start" }}>
        {list.map((a, i) => (
          <MaterialCard key={a.id} a={a} delay={i * 22} onOpen={() => setSel(a)} />
        ))}
      </div>

      {sel && (
        <MaterialDetail
          item={sel}
          onClose={() => setSel(null)}
          onSave={(patch) => save(sel.id, patch)}
          onDelete={() => remove(sel.id)}
        />
      )}
      {adding && <MaterialUpload onClose={() => setAdding(false)} onCreate={create} />}
    </div>
  );
}

function MaterialCard({ a, onOpen, delay }: { a: Material; onOpen: () => void; delay?: number }) {
  return (
    <button
      className="card col fade-up"
      onClick={onOpen}
      style={{
        padding: 0,
        overflow: "hidden",
        gap: 0,
        animationDelay: (delay || 0) + "ms",
        textAlign: "left",
        transition: "transform .15s, box-shadow .15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lg)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "none";
        e.currentTarget.style.boxShadow = "var(--shadow-sm)";
      }}
    >
      <div style={{ position: "relative" }}>
        <Thumb from={a.from} to={a.to} ratio="4/3" radius={0} stripes={false} style={{ width: "100%" }} />
        <span
          className={"tag " + (CAT_TAG[a.cat] || "tag-gray")}
          style={{ position: "absolute", top: 7, left: 7, background: "rgba(255,255,255,.92)" }}
        >
          {a.cat}
        </span>
        {a.kind === "video" && (
          <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>
            <span style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(255,255,255,.82)", display: "grid", placeItems: "center" }}>
              <Play size={13} style={{ color: "var(--ink)", marginLeft: 2 }} />
            </span>
          </span>
        )}
        <span className="thumb-label" style={{ position: "absolute", bottom: 7, right: 7 }}>
          {a.kind === "video" ? "视频" : "图片"}
        </span>
      </div>
      <div className="col gap-1" style={{ padding: "9px 10px 10px" }}>
        <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {a.name}
        </span>
        <div className="row gap-1" style={{ flexWrap: "wrap" }}>
          {(a.tags || []).slice(0, 3).map((t) => (
            <span key={t} className="tag tag-gray">
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

/* 素材详情:大预览 + 元信息(类型可改) + 关联使用 + 改 / 删 / 设为参考 */
function MaterialDetail({
  item,
  onClose,
  onSave,
  onDelete,
}: {
  item: Material;
  onClose: () => void;
  onSave: (patch: Partial<Material>) => void;
  onDelete: () => void;
}) {
  const [added, setAdded] = React.useState(false);
  const [name, setName] = React.useState(item.name);
  const [catv, setCatv] = React.useState(item.cat);
  const [tags, setTags] = React.useState((item.tags || []).join("、"));
  const [confirmDel, setConfirmDel] = React.useState(false);
  const usage = ASSET_USAGE[item.id] || [];
  const dirty = name !== item.name || catv !== item.cat || tags !== (item.tags || []).join("、");
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in row"
        style={{ width: 780, maxWidth: "94vw", maxHeight: "88vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)", alignItems: "stretch" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            flex: "0 0 44%",
            minWidth: 0,
            position: "relative",
            background: `linear-gradient(150deg, ${item.from}, ${item.to})`,
            minHeight: 400,
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(255,255,255,.85)",
              display: "grid",
              placeItems: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,.2)",
            }}
          >
            {item.kind === "video" ? (
              <Play size={24} style={{ color: "var(--ink)", marginLeft: 3 }} />
            ) : (
              <ImageIcon size={24} style={{ color: "var(--ink)" }} />
            )}
          </span>
          <span className="thumb-label" style={{ position: "absolute", bottom: 12, left: 12, whiteSpace: "nowrap" }}>
            {item.kind === "video" ? "视频素材 · 预览" : "图片素材 · 预览"}
          </span>
        </div>

        <div className="col scroll grow" style={{ minWidth: 0, padding: "18px 22px 20px", gap: 13 }}>
          <div className="row gap-2">
            <span className={"tag " + (CAT_TAG[catv] || "tag-gray")} style={{ whiteSpace: "nowrap" }}>
              {catv}
            </span>
            <span className="tag tag-gray" style={{ whiteSpace: "nowrap" }}>
              {item.kind === "video" ? "视频" : "图片"}
            </span>
            <span className="grow"></span>
            <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
              <X size={18} />
            </button>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              fontSize: 21,
              fontWeight: 800,
              border: "none",
              borderBottom: "1.5px dashed var(--line)",
              outline: "none",
              background: "transparent",
              padding: "2px 0",
              fontFamily: "inherit",
              width: "100%",
            }}
          />

          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>类型标签</span>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {MAT_CATS.map((c) => {
                const Icon = CAT_ICONS[c.key] ?? Layers;
                return (
                  <button key={c.key} className={"chip" + (catv === c.key ? " on" : "")} onClick={() => setCatv(c.key)}>
                    <Icon size={12} /> {c.key}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="row gap-2">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700, flex: "none" }}>自定义标签</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="用、分隔,如:冷感、室内"
              style={{ flex: 1, minWidth: 0, height: 30, border: "1px solid var(--line)", borderRadius: 9, padding: "0 10px", fontSize: 12, outline: "none", background: "var(--surface-2)" }}
            />
          </div>
          {dirty && (
            <button
              className="btn btn-primary btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={() =>
                onSave({
                  name: name.trim() || item.name,
                  cat: catv,
                  tags: tags.split(/[、,，\s]+/).filter(Boolean),
                })
              }
            >
              <Check size={13} /> 保存修改
            </button>
          )}

          <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.65 }}>
            生成时 @ 进来作参考:
            {catv === "人物"
              ? "替换镜头里的出镜人物,长相气质集集一致。"
              : catv === "场景"
                ? "替换镜头的环境、色调与置景,多镜连戏不跳。"
                : catv === "道具"
                  ? "锁定关键道具的外观与细节,反复出现保持一致。"
                  : "作为整体风格参考参与生成。"}
          </div>

          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: ".05em" }}>关联使用</span>
            {usage.length === 0 && (
              <span className="faint" style={{ fontSize: 12.5 }}>
                还没在项目中使用过 —— 在视频工厂用 @ 把它加进参考试试
              </span>
            )}
            {usage.map((u) => (
              <div key={u.p} className="row gap-3" style={{ padding: "8px 12px", borderRadius: 11, background: "var(--surface-2)" }}>
                <Film size={14} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{u.p}</span>
                <span className="faint" style={{ fontSize: 12 }}>{u.role}</span>
                <span className="grow"></span>
                <span className="faint num" style={{ fontSize: 12, whiteSpace: "nowrap" }}>出镜 {u.n} 镜</span>
              </div>
            ))}
          </div>

          <div className="col gap-2" style={{ marginTop: "auto" }}>
            <div className="row gap-2">
              <button className="btn btn-grad grow" style={{ justifyContent: "center" }} onClick={() => setAdded(true)}>
                {added ? (
                  <>
                    <Check size={15} /> 已加入参考
                  </>
                ) : (
                  <>
                    <Users size={15} /> 加入生成参考
                  </>
                )}
              </button>
              {!confirmDel ? (
                <button
                  className="btn btn-line"
                  style={{ flex: "none", color: "#dc2626", borderColor: "#fecaca" }}
                  onClick={() => setConfirmDel(true)}
                >
                  <X size={14} /> 删除
                </button>
              ) : (
                <button className="btn" style={{ flex: "none", background: "#dc2626", color: "#fff" }} onClick={onDelete}>
                  确认删除?
                </button>
              )}
            </div>
            <div className="faint" style={{ fontSize: 11 }}>
              加入后会出现在视频工厂的 @ 参考里 · 删除不影响已生成的镜头
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* 增:上传素材(图片/视频 + 类型标签) */
function MaterialUpload({ onClose, onCreate }: { onClose: () => void; onCreate: (m: Material) => void }) {
  const [name, setName] = React.useState("");
  const [catv, setCatv] = React.useState<string | null>(null);
  const [tags, setTags] = React.useState("");
  const [pal, setPal] = React.useState(0);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [analyzed, setAnalyzed] = React.useState(false);

  const GUESS: { cat: string; name: string; tags: string[] }[] = [
    { cat: "人物", name: "都市职场女", tags: ["知性", "冷感", "正脸"] },
    { cat: "场景", name: "夜景街道", tags: ["夜景", "冷调", "都市"] },
    { cat: "道具", name: "复古怀表", tags: ["复古", "特写", "金属"] },
  ];

  const analyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      const g = GUESS[pal % GUESS.length];
      setCatv(g.cat);
      setTags(g.tags.join("、"));
      setName((n) => (n.trim() ? n : g.name));
      setAnalyzed(true);
      setAnalyzing(false);
    }, 1100);
  };
  const ok = Boolean(name.trim() && catv);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in col"
        style={{ width: 460, maxWidth: "94vw", padding: 22, gap: 14, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-3">
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 11,
              background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
              display: "grid",
              placeItems: "center",
              flex: "none",
            }}
          >
            <Plus size={17} color="#fff" />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 16 }}>上传素材</div>
            <div className="faint" style={{ fontSize: 12 }}>图片或视频都行 · 传完让 AI 自动打标签</div>
          </div>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* 拖放区(图片/视频都收) */}
        <button
          onClick={() => setPal((pal + 1) % ASSET_PALETTES.length)}
          className="col center"
          style={{
            width: "100%",
            aspectRatio: "16/9",
            borderRadius: 14,
            background: `linear-gradient(150deg, ${ASSET_PALETTES[pal][0]}, ${ASSET_PALETTES[pal][1]})`,
            border: "1.5px dashed rgba(255,255,255,.6)",
            gap: 8,
            position: "relative",
          }}
        >
          <span style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,.85)", display: "grid", placeItems: "center" }}>
            <Plus size={19} style={{ color: "var(--ink)" }} />
          </span>
          <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 700, textShadow: "0 1px 4px rgba(0,0,0,.25)" }}>
            拖入图片 / 视频,或点击上传
          </span>
          <span className="thumb-label" style={{ position: "absolute", bottom: 8, right: 8 }}>
            演示:点一下换占位图
          </span>
        </button>

        {/* AI 自动分析标签 */}
        <button className="btn btn-line" style={{ justifyContent: "center" }} disabled={analyzing} onClick={analyze}>
          {analyzing ? (
            <>
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid var(--line)",
                  borderTopColor: "var(--accent)",
                  borderRadius: "50%",
                  animation: "drama-spin .7s linear infinite",
                }}
              ></span>{" "}
              正在识别…
            </>
          ) : (
            <>
              <Sparkles size={15} /> {analyzed ? "重新分析标签" : "AI 自动分析标签"}
            </>
          )}
        </button>

        {/* 名称 */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="素材名称"
          style={{ height: 40, border: "1.5px solid var(--line)", borderRadius: 11, padding: "0 12px", fontSize: 13.5, outline: "none", background: "var(--surface-2)" }}
        />

        {/* 类型标签(可手动改) */}
        <div className="col gap-2">
          <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>
            类型 {analyzed && catv && <span style={{ color: "var(--accent)" }}>· AI 识别为「{catv}」,可改</span>}
          </span>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {MAT_CATS.map((c) => {
              const Icon = CAT_ICONS[c.key] ?? Layers;
              return (
                <button key={c.key} className={"chip" + (catv === c.key ? " on" : "")} onClick={() => setCatv(c.key)}>
                  <Icon size={12} /> {c.key}
                </button>
              );
            })}
          </div>
        </div>

        {/* 自定义标签 */}
        <div className="col gap-2">
          <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>标签(用、分隔)</span>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="如:冷感、室内、特写"
            style={{ height: 38, border: "1.5px solid var(--line)", borderRadius: 11, padding: "0 12px", fontSize: 13, outline: "none", background: "var(--surface-2)" }}
          />
        </div>

        <div className="row gap-3" style={{ justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button
            className="btn btn-grad"
            disabled={!ok}
            style={{ opacity: ok ? 1 : 0.5 }}
            onClick={() =>
              ok &&
              catv &&
              onCreate({
                id: "u" + Date.now(),
                name: name.trim(),
                cat: catv,
                kind: "image",
                tags: tags.split(/[、,，\s]+/).filter(Boolean),
                from: ASSET_PALETTES[pal][0],
                to: ASSET_PALETTES[pal][1],
              })
            }
          >
            <Check size={15} /> 上传素材
          </button>
        </div>
      </div>
    </div>
  );
}
