"use client";

export const dynamic = "force-dynamic";

// 模板库 — 设计真源 screens-hub-v2.jsx `TemplateHub` / `TemplateCreateModal` / `TemplateSubmit`:
// 多集短剧 / 单集短视频两形态 + 类型筛选 + 统一预览弹窗;运营身份可新建模板 / 爆款拆解。
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Layers,
  Link as LinkIcon,
  Plus,
  Search,
  Sliders,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { VideoCover } from "@/components/drama-workshop/video-cover";
import { PreviewModal } from "@/components/drama-workshop/preview-modal";
import {
  CONTENT_TYPES,
  TEMPLATES,
  TPL_META,
  getTplMeta,
  type Template,
} from "@/mocks/drama-workshop";
import { useOperator } from "@/lib/use-operator";

type Scope = "all" | "multi" | "single";

type TplWithType = Template & { typeKey: string; typeName: string };

interface NewTplMeta {
  desc: string;
  cover: { from: string; to: string };
}

export default function TemplatesPage() {
  const router = useRouter();
  const [operator, setOperator] = useOperator();
  const [filter, setFilter] = React.useState("all");
  const [scope, setScope] = React.useState<Scope>("all"); // all / multi 多集短剧 / single 单集短视频
  const [q, setQ] = React.useState("");
  const [pv, setPv] = React.useState<TplWithType | null>(null); // 点卡片 → 统一预览弹窗
  const [adding, setAdding] = React.useState(false);
  const [, force] = React.useState(0);

  const all: TplWithType[] = Object.entries(TEMPLATES).flatMap(([k, arr]) =>
    arr.map((tp) => ({
      ...tp,
      typeKey: k,
      typeName: CONTENT_TYPES.find((c) => c.key === k)?.name ?? "",
    })),
  );
  const inScope = (tp: TplWithType) =>
    scope === "all" || (scope === "multi" ? tp.eps > 1 : tp.eps <= 1);
  const list = all.filter(
    (tp) =>
      inScope(tp) &&
      (filter === "all" || tp.typeKey === filter) &&
      (!q || tp.name.includes(q) || (tp.hooks || []).some((h) => h.includes(q))),
  );
  const multiN = all.filter((tp) => tp.eps > 1).length;
  const singleN = all.filter((tp) => tp.eps <= 1).length;
  const typeKeys = Object.keys(TEMPLATES).filter((k) =>
    all.some((tp) => tp.typeKey === k && inScope(tp)),
  );

  const handleUse = (derive: boolean) => {
    router.push("/projects/p1?from=template");
    toast.success(derive ? "已衍生模板结构,大纲可直接改" : "模板已预填大纲与钩子,改改就能用");
  };

  const handleCreate = (tp: Template, typeKey: string, meta: NewTplMeta) => {
    if (!TEMPLATES[typeKey]) TEMPLATES[typeKey] = [];
    TEMPLATES[typeKey].push(tp);
    TPL_META[tp.id] = { desc: meta.desc || tp.pace, cover: meta.cover };
    setAdding(false);
    setScope("all");
    setFilter(typeKey);
    force((n) => n + 1);
    toast.success(`模板「${tp.name}」已存入模板库`);
  };

  const scopeTabs: [Scope, string, number][] = [
    ["all", "全部", all.length],
    ["multi", "多集短剧", multiN],
    ["single", "单集短视频", singleN],
  ];

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div className="row" style={{ marginBottom: 22 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: "-.02em" }}>模板库</h1>
          <div className="muted" style={{ marginTop: 4 }}>
            验证过的爆款结构 —— 多集短剧、单集短视频都在这里,一键开用或衍生
          </div>
        </div>
        <div className="grow"></div>
        {operator && (
          <button className="btn btn-grad" style={{ height: 40, flex: "none" }} onClick={() => setAdding(true)}>
            <Plus size={15} /> 新建模板
          </button>
        )}
        <div className="row card" style={{ padding: "0 14px", height: 40, width: 240, gap: 8, borderRadius: 999, flex: "none" }}>
          <Search size={16} style={{ color: "var(--ink-3)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜模板 / 钩子…"
            style={{ border: "none", outline: "none", background: "transparent", flex: 1, fontSize: 13.5 }}
          />
        </div>
      </div>

      {/* 剧目形态筛选:多集 / 单集 */}
      <div className="row gap-2" style={{ marginBottom: 14 }}>
        {scopeTabs.map(([k, label, n]) => {
          const on = scope === k;
          return (
            <button
              key={k}
              onClick={() => {
                setScope(k);
                setFilter("all");
              }}
              className="row gap-2"
              style={{
                padding: "8px 16px",
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 13.5,
                flex: "none",
                border: on ? "2px solid var(--accent)" : "1.5px solid var(--line)",
                background: on ? "var(--accent-soft)" : "var(--surface)",
                color: on ? "var(--accent)" : "var(--ink-2)",
              }}
            >
              {k === "multi" && <Layers size={14} />}
              {k === "single" && <Zap size={14} />}
              {label}{" "}
              <span className="num faint" style={{ fontSize: 11.5, fontWeight: 600 }}>
                {n}
              </span>
            </button>
          );
        })}
      </div>

      <div className="row gap-2" style={{ flexWrap: "wrap", marginBottom: 20 }}>
        <button className={"chip" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
          全部类型 · {list.length}
        </button>
        {typeKeys.map((k) => {
          const name = CONTENT_TYPES.find((c) => c.key === k)?.name ?? "";
          return (
            <button key={k} className={"chip" + (filter === k ? " on" : "")} onClick={() => setFilter(k)}>
              {name}
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(248px,1fr))", gap: 16, alignItems: "start" }}>
        {list.map((tp, i) => {
          const m = getTplMeta(tp);
          return (
            <div
              key={tp.id}
              className="card col fade-up"
              onClick={() => setPv(tp)}
              style={{
                padding: 0,
                overflow: "hidden",
                gap: 0,
                animationDelay: i * 30 + "ms",
                cursor: "pointer",
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
              <VideoCover from={m.cover.from} to={m.cover.to} ratio={tp.eps > 1 ? "4/3" : "16/9"} label="效果预览">
                <span className="thumb-label" style={{ position: "absolute", top: 8, left: 8 }}>
                  {tp.typeName}
                </span>
                <span className="thumb-label num" style={{ position: "absolute", top: 8, right: 8 }}>
                  {tp.eps > 1 ? tp.eps + " 集" : "单集"}
                </span>
              </VideoCover>
              <div className="col" style={{ padding: 16, gap: 11, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{tp.name}</div>
                <div
                  className="muted"
                  style={{
                    fontSize: 12.5,
                    lineHeight: 1.55,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {m.desc}
                </div>
                <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                  {tp.hooks.map((h) => (
                    <span key={h} className="tag tag-gray">
                      {h}
                    </span>
                  ))}
                </div>
                <div className="faint" style={{ fontSize: 12 }}>节奏卡点 · {tp.pace}</div>
                <div className="row gap-2" style={{ marginTop: "auto" }}>
                  <button
                    className="btn btn-primary btn-sm grow"
                    style={{ justifyContent: "center" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUse(false);
                    }}
                  >
                    <Zap size={14} /> {tp.eps > 1 ? "一键开剧" : "一键开做"}
                  </button>
                  <button
                    className="btn btn-line btn-sm grow"
                    style={{ justifyContent: "center" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUse(true);
                    }}
                  >
                    <Copy size={14} /> 衍生改编
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card row gap-3" style={{ marginTop: 24, padding: 18 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            background: "var(--accent-soft)",
            display: "grid",
            placeItems: "center",
            color: "var(--accent)",
            flex: "none",
          }}
        >
          <LinkIcon size={20} />
        </div>
        <div className="grow">
          <div style={{ fontWeight: 700 }}>看到一部爆款想抄结构?</div>
          <div className="faint" style={{ fontSize: 12.5, marginTop: 2 }}>
            把链接丢进来,AI 拆出可复用的骨架,自动入库到对应类型下
          </div>
        </div>
        {operator ? (
          <TemplateSubmit />
        ) : (
          <button className="btn btn-line" style={{ flex: "none" }} onClick={() => setOperator(true)}>
            <Sliders size={14} /> 开启运营身份添加
          </button>
        )}
      </div>

      {pv &&
        (() => {
          const m = getTplMeta(pv);
          return (
            <PreviewModal
              item={{
                cover: m.cover,
                title: pv.name,
                cat: pv.typeName,
                desc: m.desc,
                tpl: pv,
                tags: pv.hooks,
                coverLabel: "模板效果预览 · 同结构成片片段",
              }}
              onClose={() => setPv(null)}
              actions={[
                {
                  label: "衍生改编",
                  icon: <Copy size={15} />,
                  variant: "line",
                  onClick: () => {
                    setPv(null);
                    handleUse(true);
                  },
                },
                {
                  label: "一键开剧",
                  icon: <Zap size={15} />,
                  variant: "grad",
                  cost: 18,
                  onClick: () => {
                    setPv(null);
                    handleUse(false);
                  },
                },
              ]}
            />
          );
        })()}
      {adding && <TemplateCreateModal onClose={() => setAdding(false)} onCreate={handleCreate} />}
    </div>
  );
}

/* 新建模板(运营身份) */
function TemplateCreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (tp: Template, typeKey: string, meta: NewTplMeta) => void;
}) {
  const types = CONTENT_TYPES.filter((t) => t.key !== "custom");
  const [typeKey, setTypeKey] = React.useState(types[0].key);
  const [name, setName] = React.useState("");
  const [eps, setEps] = React.useState("80");
  const [single, setSingle] = React.useState(false);
  const [desc, setDesc] = React.useState("");
  const [hooks, setHooks] = React.useState("");
  const [pal, setPal] = React.useState(0);
  const PALS: [string, string][] = [
    ["#7c3aed", "#ec4899"],
    ["#db2777", "#9333ea"],
    ["#f472b6", "#fb7185"],
    ["#3b82f6", "#8b5cf6"],
    ["#f59e0b", "#ef4444"],
    ["#10b981", "#22d3ee"],
  ];
  const ok = name.trim().length > 0;
  const submit = () => {
    if (!ok) return;
    const hk = hooks
      .split(/[、,，\s]+/)
      .filter(Boolean)
      .slice(0, 3);
    const tp: Template = {
      id: "ut" + Date.now(),
      name: name.trim(),
      eps: single ? 1 : Math.max(2, Number(eps) || 60),
      pace: "运营自建 · 可调",
      scene: "自定义",
      hooks: hk.length ? hk : ["自定义结构"],
    };
    onCreate(tp, typeKey, { desc: desc.trim(), cover: { from: PALS[pal][0], to: PALS[pal][1] } });
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in col"
        style={{ width: 560, maxWidth: "94vw", maxHeight: "88vh", padding: 0, overflow: "hidden", boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-3" style={{ padding: "16px 20px 12px", flex: "none" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 11,
              background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
              display: "grid",
              placeItems: "center",
              flex: "none",
            }}
          >
            <Layers size={18} color="#fff" />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 16 }}>新建模板</div>
            <div className="faint" style={{ fontSize: 12 }}>运营身份 · 入库后所有人都能一键套用</div>
          </div>
          <span className="tag tag-accent" style={{ flex: "none" }}>运营</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="scroll col gap-4" style={{ padding: "4px 20px 16px", minHeight: 0 }}>
          <div className="col gap-2">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>预览封面配色</span>
            <div className="row gap-3">
              <div
                style={{
                  width: 70,
                  aspectRatio: single ? "16/9" : "3/4",
                  borderRadius: 10,
                  background: `linear-gradient(150deg,${PALS[pal][0]},${PALS[pal][1]})`,
                  flex: "none",
                }}
              ></div>
              <div className="row gap-1" style={{ flexWrap: "wrap", alignContent: "flex-start" }}>
                {PALS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPal(i)}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 7,
                      background: `linear-gradient(135deg,${p[0]},${p[1]})`,
                      border: pal === i ? "2px solid var(--ink)" : "2px solid transparent",
                    }}
                  ></button>
                ))}
              </div>
            </div>
          </div>
          <div className="col gap-1">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>模板名称</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="比如:都市悬疑·身份反转"
              style={{ height: 40, border: "1.5px solid var(--line)", borderRadius: 11, padding: "0 12px", fontSize: 13.5, outline: "none", background: "var(--surface-2)" }}
            />
          </div>
          <div className="col gap-1">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>所属类型</span>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {types.map((t) => (
                <button key={t.key} className={"chip" + (typeKey === t.key ? " on" : "")} onClick={() => setTypeKey(t.key)}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="row gap-3" style={{ alignItems: "center", flexWrap: "wrap" }}>
            <button className={"chip" + (!single ? " on" : "")} onClick={() => setSingle(false)}>
              <Layers size={12} /> 多集短剧
            </button>
            <button className={"chip" + (single ? " on" : "")} onClick={() => setSingle(true)}>
              <Zap size={12} /> 单集短视频
            </button>
            {!single && (
              <div className="row gap-2" style={{ alignItems: "center" }}>
                <span className="faint" style={{ fontSize: 12 }}>集数</span>
                <input
                  type="number"
                  min="2"
                  value={eps}
                  onChange={(e) => setEps(e.target.value)}
                  style={{ width: 70, height: 34, border: "1.5px solid var(--line)", borderRadius: 9, padding: "0 10px", fontSize: 13, outline: "none", background: "var(--surface-2)" }}
                />
              </div>
            )}
          </div>
          <div className="col gap-1">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>一句话描述</span>
            <input
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="这个结构怎么走、特色是什么"
              style={{ height: 38, border: "1.5px solid var(--line)", borderRadius: 11, padding: "0 12px", fontSize: 13, outline: "none", background: "var(--surface-2)" }}
            />
          </div>
          <div className="col gap-1">
            <span className="faint" style={{ fontSize: 11.5, fontWeight: 700 }}>钩子标签(用、分隔,最多 3 个)</span>
            <input
              value={hooks}
              onChange={(e) => setHooks(e.target.value)}
              placeholder="开场即悬念、中段大反转、末集双线收束"
              style={{ height: 38, border: "1.5px solid var(--line)", borderRadius: 11, padding: "0 12px", fontSize: 13, outline: "none", background: "var(--surface-2)" }}
            />
          </div>
        </div>
        <div className="row gap-3" style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", justifyContent: "flex-end", flex: "none" }}>
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-grad" disabled={!ok} style={{ opacity: ok ? 1 : 0.5 }} onClick={submit}>
            <Check size={15} /> 存入模板库
          </button>
        </div>
      </div>
    </div>
  );
}

/* 爆款拆解(运营身份内联提交) */
function TemplateSubmit() {
  const [v, setV] = React.useState("");
  const [sent, setSent] = React.useState(false);
  return (
    <div className="row gap-2" style={{ flex: "none" }}>
      <input
        value={v}
        onChange={(e) => {
          setV(e.target.value);
          setSent(false);
        }}
        placeholder="粘贴爆款链接…"
        style={{ height: 38, width: 220, border: "1.5px solid var(--line)", borderRadius: 11, padding: "0 12px", fontSize: 13, outline: "none", background: "var(--surface-2)" }}
      />
      <button className="btn btn-line btn-sm" style={{ height: 38 }} onClick={() => setSent(true)}>
        {sent ? (
          <>
            <Check size={14} /> 已提交拆解
          </>
        ) : (
          <>
            <Wand2 size={14} /> 拆成模板
          </>
        )}
      </button>
    </div>
  );
}
