"use client";

// 引导式立项起点 — 设计真源:screens-entry.jsx `GuidedStart / ConvStep / FIVE_DIMS / FiveDimCard`。
// 三步:理解想法 → 五维挖掘 → 选题方向。
import * as React from "react";
import {
  ArrowRight,
  Zap,
  Check,
  ChevronRight,
  Film,
  Image as ImageIcon,
  List,
  Mic,
  Plus,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Cost, Editable, GenSkeleton, Meta } from "@/components/drama-ui";
import {
  PROJECT_DATA,
  type ContentType,
  type TopicCard,
} from "@/mocks/drama-workshop";

interface FiveDim {
  key: string;
  name: string;
  Icon: LucideIcon;
  sug: string[];
}

const FIVE_DIMS: FiveDim[] = [
  { key: "narrative", name: "内容叙事", Icon: List,        sug: ["目击命案开局", "身份反转中段", "双线收束结局", "女主第一视角"] },
  { key: "visual",    name: "视觉风格", Icon: ImageIcon,   sug: ["冷色调都市夜", "电影级颗粒感", "竖屏 9:16", "霓虹光污染"] },
  { key: "lens",      name: "镜头语言", Icon: Film,        sug: ["中近景为主", "手持主观", "缓慢推近", "特写抓情绪"] },
  { key: "rhythm",    name: "动作与节奏", Icon: Zap,         sug: ["前 3 集高密度反转", "每集结尾留扣", "钩子卡在 3 秒内"] },
  { key: "sound",     name: "声音设计", Icon: Mic,         sug: ["低沉弦乐", "环境雨声", "气声台词", "心跳音效"] },
];

interface DimItem {
  text: string;
  ai: boolean;
}

interface GuidedStartProps {
  type: ContentType;
  onEnter: (payload: { mode: "guided"; topic: string; projectId: string }) => void;
}

export function GuidedStart({ type, onEnter }: GuidedStartProps) {
  const [idea, setIdea] = React.useState("");
  const [gen, setGen] = React.useState(false);
  const [cards, setCards] = React.useState<TopicCard[] | null>(null);
  const [pick, setPick] = React.useState<string>("");
  const [dims, setDims] = React.useState<Record<string, DimItem[]>>(() =>
    Object.fromEntries(
      FIVE_DIMS.map((d) => [d.key, d.sug.map((t) => ({ text: t, ai: true }))]),
    ),
  );

  // 用样例项目的 topicCards(按类型)做演示数据
  const sampleProjectId = sampleProjectByType(type.key);
  const sample = PROJECT_DATA[sampleProjectId];

  const run = () => {
    setGen(true);
    setCards(null);
    setTimeout(() => {
      setGen(false);
      const next = sample?.topicCards ?? [];
      setCards(next);
      setPick(next[0]?.id ?? "");
    }, 1400);
  };

  const addDim = (k: string) =>
    setDims((s) => ({ ...s, [k]: [...s[k], { text: "", ai: false }] }));
  const rmDim = (k: string, i: number) =>
    setDims((s) => ({ ...s, [k]: s[k].filter((_, j) => j !== i) }));
  const edDim = (k: string, i: number, v: string) =>
    setDims((s) => ({
      ...s,
      [k]: s[k].map((x, j) => (j === i ? { text: v, ai: false } : x)),
    }));

  const enter = () => {
    if (!pick) return;
    onEnter({ mode: "guided", topic: pick, projectId: sampleProjectId });
  };

  return (
    <div className="card fade-up" style={{ marginTop: 28, padding: 24 }}>
      {/* 三步指示 */}
      <div
        className="row gap-3"
        style={{ marginBottom: 18, flexWrap: "wrap" }}
      >
        <ConvStep n={1} label="理解想法" active={!cards} done={!!cards} />
        <ChevronRight size={14} style={{ color: "var(--ink-3)" }} />
        <ConvStep n={2} label="五维挖掘" active={!!cards} done={false} />
        <ChevronRight size={14} style={{ color: "var(--ink-3)" }} />
        <ConvStep n={3} label="选题方向" active={!!cards} done={false} />
      </div>

      <div className="row gap-3" style={{ marginBottom: 4 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "linear-gradient(135deg,var(--accent),var(--accent-2))",
            display: "grid",
            placeItems: "center",
            flex: "none",
            color: "#fff",
          }}
        >
          <Sparkles size={17} fill="currentColor" strokeWidth={0} />
        </div>
        <div style={{ fontWeight: 700 }}>先说说你想讲个什么故事?</div>
      </div>
      <div
        className="faint"
        style={{ fontSize: 12, marginBottom: 14, paddingLeft: 42 }}
      >
        一次说一两句就行,AI 会陪你一步步把它问清楚。
      </div>
      <div
        className="row gap-3"
        style={{ marginBottom: cards || gen ? 24 : 0, flexWrap: "wrap" }}
      >
        <input
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="一句话点子,比如:都市白领发现对面公寓的命案是为她设的局…"
          style={{
            flex: 1,
            minWidth: 240,
            height: 46,
            border: "1.5px solid var(--line)",
            borderRadius: 12,
            padding: "0 16px",
            fontSize: 14,
            outline: "none",
            background: "var(--surface-2)",
            color: "var(--ink)",
            fontFamily: "var(--font)",
          }}
        />
        <button
          type="button"
          className="btn btn-grad"
          style={{ height: 46 }}
          onClick={run}
        >
          <Wand2 size={16} /> {cards ? "重新挖掘" : "开始挖掘"}
        </button>
        <Cost n={6} />
      </div>

      {gen && <GenSkeleton lines={3} label="AI 正在沿五个维度追问、并扩写选题方向…" />}

      {cards && (
        <div className="col gap-4 fade-up" style={{ marginTop: 18 }}>
          {/* 五维挖掘 */}
          <div>
            <div className="row gap-2" style={{ marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                AI 已经从你的点子里提炼了这五维
              </span>
              <span className="faint" style={{ fontSize: 12 }}>
                · 可改可补,也能直接跳过
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
                gap: 12,
              }}
            >
              {FIVE_DIMS.map((d) => (
                <FiveDimCard
                  key={d.key}
                  dim={d}
                  items={dims[d.key]}
                  onAdd={() => addDim(d.key)}
                  onRemove={(i) => rmDim(d.key, i)}
                  onEdit={(i, v) => edDim(d.key, i, v)}
                />
              ))}
            </div>
          </div>

          {/* 选题方向 */}
          <div className="col gap-3">
            <div className="faint" style={{ fontSize: 12.5, fontWeight: 600 }}>
              顺着这五维,AI 扩了几个选题方向 —— 挑一个开拍,进工作台还能继续改
            </div>
            {cards.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setPick(c.id)}
                className="card col fade-up"
                style={{
                  padding: 18,
                  textAlign: "left",
                  gap: 10,
                  border:
                    pick === c.id
                      ? "2px solid var(--accent)"
                      : "1.5px solid var(--line-soft)",
                  cursor: "pointer",
                }}
              >
                <div className="row gap-3">
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{c.title}</div>
                  {pick === c.id && (
                    <span className="tag tag-accent">
                      <Check size={11} /> 已选
                    </span>
                  )}
                </div>
                <div className="muted" style={{ fontSize: 13 }}>{c.main}</div>
                <div
                  className="row"
                  style={{ flexWrap: "wrap", gap: 16, marginTop: 2 }}
                >
                  <Meta label="黄金 3 秒" v={c.hook} />
                  <Meta label="节奏" v={c.pace} />
                  <Meta label="受众" v={c.audience} />
                </div>
              </button>
            ))}
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={enter}
                disabled={!pick}
              >
                用这个方向开拍 <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ConvStep({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div
      className="row gap-2"
      style={{
        color: active ? "var(--accent)" : done ? "var(--ink)" : "var(--ink-3)",
        fontWeight: active ? 700 : 600,
        fontSize: 13,
      }}
    >
      <span
        className="num"
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          fontSize: 11.5,
          background: active
            ? "var(--accent)"
            : done
              ? "var(--accent-soft)"
              : "var(--surface-2)",
          color: active ? "#fff" : done ? "var(--accent)" : "var(--ink-3)",
        }}
      >
        {done ? <Check size={12} /> : n}
      </span>
      {label}
    </div>
  );
}

function FiveDimCard({
  dim,
  items,
  onAdd,
  onRemove,
  onEdit,
}: {
  dim: FiveDim;
  items: DimItem[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onEdit: (i: number, v: string) => void;
}) {
  return (
    <div className="card col gap-2" style={{ padding: 14 }}>
      <div className="row gap-2">
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--accent-soft)",
            display: "grid",
            placeItems: "center",
            color: "var(--accent)",
            flex: "none",
          }}
        >
          <dim.Icon size={15} />
        </div>
        <span style={{ fontWeight: 700, fontSize: 13.5 }}>{dim.name}</span>
        <span
          className="tag tag-accent"
          style={{ height: 18, padding: "0 7px" }}
        >
          <Sparkles size={10} fill="currentColor" strokeWidth={0} /> AI 已建议
        </span>
      </div>
      <div className="row gap-2" style={{ flexWrap: "wrap" }}>
        {items.map((it, i) => (
          <span
            key={i}
            className="row"
            style={{
              height: 28,
              padding: "0 4px 0 11px",
              borderRadius: 999,
              gap: 4,
              fontSize: 12.5,
              fontWeight: 600,
              background: it.ai ? "var(--accent-soft)" : "var(--surface-2)",
              color: it.ai ? "var(--accent)" : "var(--ink)",
            }}
          >
            {it.ai ? (
              it.text
            ) : (
              <Editable
                value={it.text}
                placeholder="补充…"
                onCommit={(v) => onEdit(i, v)}
                style={{ minWidth: 40 }}
              />
            )}
            <button
              type="button"
              onClick={() => onRemove(i)}
              title="去掉"
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                color: "inherit",
                opacity: 0.65,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        <button type="button" className="chip" onClick={onAdd}>
          <Plus size={12} /> 补充
        </button>
      </div>
    </div>
  );
}

// 按类型 key 取一个对应的样例项目 id
function sampleProjectByType(typeKey: string): string {
  switch (typeKey) {
    case "mystery":   return "p1";
    case "palace":    return "p2";
    case "romance":   return "p3";
    case "public":    return "p4";
    case "scifi":     return "p5";
    case "corporate": return "p6";
    default:          return "p1";
  }
}
