"use client";

// 脚本工坊 · 编辑器 —— ProductHero（商品锚定 + 3 起稿入口）+ ScriptEditor（分镜编辑）
// + AgentPanel（智能体校验右栏）+ DraftingHub（全屏起稿）+ 镜头级动作抽屉。

import * as React from "react";
import {
  Wand2, LayoutTemplate, Flame, Check, Copy, ChevronRight, ChevronUp, ChevronDown,
  Plus, Trash2, GripVertical, TriangleAlert, X, ShieldCheck, Pencil, Sparkles,
} from "lucide-react";
import { ProductsApi } from "@/api";
import { AiErrorNotice, errorMessage } from "@/components/common/ai-error-notice";
import { AiThinking } from "@/components/common/ai-thinking";
import { Card, Button } from "@/components/creator";
import {
  BLOCK_SNIPPETS, BANNED_WORDS, WORD_SUGGESTIONS, PLATFORM_RULES, SHOT_KIND_META, TIER_META,
} from "@/constants/material-ops-ui";
import { VIRAL_HITS } from "@/mocks/material-ops";
import type { MaterialProduct, PlatformId, ScriptAsset, ScriptBlock, ShotKind } from "./types";
import { DraftingHub } from "./DraftingHub";
import { Eyebrow, Tag, TierBadge, ProductThumb, hexA } from "./shared";
import { useProductThumbUrl } from "./product-thumbnails";

const SHOT_KINDS: ShotKind[] = ["hook", "scene", "emotion", "product", "effect", "cta"];

// 画面 / 分镜快捷填入（追加到 shot 字段）。
const SHOT_QUICK_FILLS = ["近景", "中景", "远景", "特写", "跟拍", "主播出镜", "产品特写", "使用过程", "前后对比", "场景转换"];

export function WorkshopScreen({
  draft,
  setDraft,
  product,
  onSaveAndPreview,
  onDelete,
  onProductChange,
}: {
  draft: ScriptAsset;
  setDraft: (d: ScriptAsset) => void;
  product: MaterialProduct;
  onSaveAndPreview: () => void;
  onDelete?: () => void;
  onProductChange?: (product: MaterialProduct) => void;
}) {
  const [platform, setPlatform] = React.useState<PlatformId>("douyin");
  const [hub, setHub] = React.useState<"template" | "viral" | "ai" | null>(null);
  const [drawer, setDrawer] = React.useState<{ blockIndex: number; kind: "template" | "viral" | "ai" } | null>(null);

  const applyAsset = (blocks: ScriptBlock[]) => setDraft({ ...draft, blocks });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "relative" }}>
      {/* title bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <Eyebrow>脚本工坊</Eyebrow>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 4 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: "-0.01em", color: "var(--fg-0)" }}>
              {draft.name || "新脚本"} ·{" "}
              <span style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 400 }}>{draft.id}</span>
            </h1>
            <TierBadge tier={draft.tier} />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button variant="secondary" size="md">
            <Copy size={13} /> 另存为模板
          </Button>
          {onDelete && (
            <Button variant="danger" size="md" onClick={onDelete}>
              <Trash2 size={13} /> 删除脚本
            </Button>
          )}
          <Button variant="accent" size="md" onClick={onSaveAndPreview}>
            <Check size={13} /> 保存并预览 →
          </Button>
        </div>
      </div>

      <ProductHero
        product={product}
        onProductChange={onProductChange}
        onTemplate={() => setHub("template")}
        onViral={() => setHub("viral")}
        onAI={() => setHub("ai")}
      />

      {/* 窄屏：Agent 面板（平台 / 校验）落到编辑器下方，单列堆叠 */}
      <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 16, alignItems: "flex-start" }}>
        <ScriptEditor draft={draft} setDraft={setDraft} platform={platform} onBlockAction={(i, k) => setDrawer({ blockIndex: i, kind: k })} />
        <AgentPanel draft={draft} platform={platform} setPlatform={setPlatform} />
      </div>

      {drawer && (
        <BlockDrawer
          draft={draft}
          setDraft={setDraft}
          product={product}
          blockIndex={drawer.blockIndex}
          kind={drawer.kind}
          onClose={() => setDrawer(null)}
        />
      )}

      {hub && (
        <DraftingHub
          openTab={hub}
          product={product}
          onClose={() => setHub(null)}
          onApply={(blocks) => {
            applyAsset(blocks);
            setHub(null);
          }}
          onApplyAndPreview={(blocks) => {
            applyAsset(blocks);
            setHub(null);
            setTimeout(onSaveAndPreview, 0);
          }}
        />
      )}
    </div>
  );
}

// ── Product Hero ─────────────────────────────────────────────────────────────
function ProductHero({
  product,
  onProductChange,
  onTemplate,
  onViral,
  onAI,
}: {
  product: MaterialProduct;
  onProductChange?: (product: MaterialProduct) => void;
  onTemplate: () => void;
  onViral: () => void;
  onAI: () => void;
}) {
  const yuan = product.priceCents ? `¥${(product.priceCents / 100).toFixed(0)}` : "—";
  const thumbUrl = useProductThumbUrl(product);
  const [sellingPoints, setSellingPoints] = React.useState(product.sellingPoints ?? "");
  const [extracting, setExtracting] = React.useState(false);
  const [extractError, setExtractError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setSellingPoints(product.sellingPoints ?? "");
    setExtractError(null);
  }, [product.id, product.sellingPoints]);

  const sellingPointList = React.useMemo(() => {
    const parsed = splitSellingPoints(sellingPoints);
    return parsed.length ? parsed : (product.sellingPointList ?? []);
  }, [product.sellingPointList, sellingPoints]);

  const extractSelling = async () => {
    if (!product.link?.trim()) {
      setExtractError("该商品缺少链接，无法 AI 提取卖点（请先在商品库补充链接）");
      return;
    }

    setExtracting(true);
    setExtractError(null);
    try {
      const { sellingPoints: nextSellingPoints } = await ProductsApi.extractSellingPoints({
        name: product.name,
        link: product.link,
      });
      const nextProduct = {
        ...product,
        sellingPoints: nextSellingPoints,
        sellingPointList: splitSellingPoints(nextSellingPoints),
      };
      setSellingPoints(nextSellingPoints);
      onProductChange?.(nextProduct);
    } catch (e) {
      setExtractError(errorMessage(e, "AI 提取卖点失败，请稍后重试"));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <Card style={{ padding: 0, overflow: "hidden", background: `linear-gradient(110deg, ${hexA(product.accentColor ?? "#7c5cff", "1f")} 0%, transparent 38%), var(--bg-1)`, border: `1px solid ${hexA(product.accentColor ?? "#7c5cff", "44")}` }}>
      <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "auto 1.4fr 1fr auto", alignItems: "stretch" }}>
        <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 16, borderRight: "1px solid var(--line)" }}>
          <ProductThumb name={product.name} image={thumbUrl} color={product.accentColor} size={64} radius="var(--radius-lg)" />

          <div style={{ minWidth: 0 }}>
            <Eyebrow style={{ marginBottom: 4 }}>关联商品</Eyebrow>
            <div style={{ fontSize: 16, color: "var(--fg-0)", fontWeight: 600, whiteSpace: "nowrap" }}>{product.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <Tag color="var(--fg-2)">{product.category}</Tag>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--extra-teal)", fontWeight: 600 }}>{yuan}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>佣金 {product.commissionRate ?? "—"}%</span>
            </div>
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderRight: "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <Eyebrow>AI 帮你提取的卖点</Eyebrow>
              <Tag color="var(--extra-teal)" style={{ fontSize: 9, padding: "1px 5px" }}>AI 自动</Tag>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={extractSelling}
              disabled={extracting}
              title={product.link?.trim() ? "基于商品名和链接重新提取卖点" : "该商品缺少链接，无法提取"}
              style={{
                height: 26,
                padding: "4px 9px",
                fontSize: 11,
                gap: 5,
                opacity: extracting ? 0.7 : 1,
                cursor: extracting ? "wait" : "pointer",
                flexShrink: 0,
              }}
            >
              <Sparkles size={11} /> {extracting ? "提取中" : "AI 提取"}
            </Button>
          </div>
          {extracting && (
            <div style={{ marginBottom: 8 }}>
              <AiThinking compact stages={["读取商品信息…", "提炼卖点…", "整理输出…"]} />
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, minHeight: 24 }}>
            {sellingPointList.length > 0 ? sellingPointList.map((s) => (
              <span key={s} style={{ fontSize: 11, color: "var(--fg-1)", background: "var(--bg-2)", padding: "4px 9px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)" }}>
                {s}
              </span>
            )) : (
              <span style={{ fontSize: 11, color: "var(--fg-3)", lineHeight: 1.7 }}>暂无卖点 · 点击 AI 提取后用于当前脚本起稿</span>
            )}
          </div>
          {extractError && (
            <div style={{ marginTop: 8 }}>
              <AiErrorNotice title="AI 提取卖点失败" message={extractError} onRetry={extractSelling} />
            </div>
          )}
        </div>

        <div style={{ padding: "14px 20px" }}>
          <Eyebrow style={{ marginBottom: 8 }}>推荐角度</Eyebrow>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {(product.suggestedAngles ?? []).map((a, i) => (
              <span
                key={a}
                style={{
                  fontSize: 11,
                  color: i === 0 ? "var(--accent)" : "var(--fg-1)",
                  background: i === 0 ? hexA("#7c5cff", "1f") : "var(--bg-2)",
                  padding: "4px 9px",
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${i === 0 ? "var(--accent)" : "var(--line)"}`,
                }}
              >
                {a}
              </span>
            ))}
          </div>
          <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
            目标人群 · {(product.audience ?? []).slice(0, 2).join(" / ")}
          </div>
        </div>

        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 7, borderLeft: "1px solid var(--line)", minWidth: 220, background: `linear-gradient(180deg, ${hexA("#22b59a", "0a")}, ${hexA("#7c5cff", "0a")})` }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", color: "var(--fg-3)", textTransform: "uppercase", marginBottom: 2 }}>起稿方式</div>
          <HeroAction icon={<Wand2 size={14} />} label="AI 生成脚本" sub="智能体起 N 稿 · 可切换" tone="var(--extra-teal)" primary onClick={onAI} />
          <HeroAction icon={<LayoutTemplate size={14} />} label="套用模板" sub="从爆款模板库选起" tone="var(--accent)" onClick={onTemplate} />
          <HeroAction icon={<Flame size={14} />} label="套同款爆款" sub="粘贴链接 · 全本复刻" tone="var(--danger)" onClick={onViral} />
        </div>
      </div>
    </Card>
  );
}

function splitSellingPoints(text?: string | null): string[] {
  return (text ?? "")
    .split(/[\/、,，;；。.\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function HeroAction({ icon, label, sub, tone, primary, onClick }: { icon: React.ReactNode; label: string; sub: string; tone: string; primary?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 11px",
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        background: primary ? tone : hexA(tone, "14"),
        border: `1px solid ${primary ? tone : hexA(tone, "55")}`,
        color: primary ? "#fff" : tone,
        textAlign: "left",
        fontFamily: "var(--font-sans)",
      }}
    >
      <span style={{ width: 26, height: 26, borderRadius: "var(--radius-sm)", flexShrink: 0, background: primary ? "rgba(255,255,255,0.2)" : hexA(tone, "1f"), color: primary ? "#fff" : tone, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, lineHeight: 1.3 }}>{label}</span>
        <span style={{ display: "block", fontSize: 10, lineHeight: 1.3, color: primary ? "rgba(255,255,255,0.8)" : "var(--fg-3)", fontFamily: "var(--font-mono)", marginTop: 1 }}>{sub}</span>
      </span>
      <ChevronRight size={11} style={{ opacity: 0.7 }} />
    </button>
  );
}

// ── Script Editor ────────────────────────────────────────────────────────────
function ScriptEditor({ draft, setDraft, platform, onBlockAction }: { draft: ScriptAsset; setDraft: (d: ScriptAsset) => void; platform: PlatformId; onBlockAction: (i: number, k: "template" | "viral" | "ai") => void }) {
  const blocks = draft.blocks;
  const totalDur = blocks.reduce((s, b) => s + b.dur, 0);

  const update = (i: number, patch: Partial<ScriptBlock>) => setDraft({ ...draft, blocks: blocks.map((b, ii) => (ii === i ? { ...b, ...patch } : b)) });
  const remove = (i: number) => setDraft({ ...draft, blocks: blocks.filter((_, ii) => ii !== i) });
  const move = (i: number, dir: number) => {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    setDraft({ ...draft, blocks: next });
  };
  const insert = (at: number) => {
    const next = [...blocks];
    next.splice(at, 0, { kind: "scene", label: "新镜头", dur: 6, text: "", shot: "" });
    setDraft({ ...draft, blocks: next });
  };

  return (
    <Card style={{ padding: 0, overflow: "hidden", minHeight: 560 }}>
      <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "var(--fg-2)" }}>
            <Pencil size={9} />
            <Eyebrow>脚本标题 · 可编辑</Eyebrow>
          </div>
          <input
            value={draft.title ?? draft.name}
            onChange={(e) => setDraft({ ...draft, title: e.target.value, name: e.target.value })}
            placeholder="为脚本起一个标题…"
            title="点击编辑脚本标题"
            className="mo-titleedit"
            style={{ marginTop: 4, width: "100%", background: "transparent", color: "var(--fg-0)", fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em", outline: "none", paddingTop: 2, paddingBottom: 2 }}
          />
        </div>
        <Tag color="var(--accent)">共 {blocks.length} 镜</Tag>
        <Tag color="var(--extra-teal)">{totalDur}s 总时长</Tag>
      </div>

      {/* timeline：按时长比例的可点片段，段内标「序号 · 类型 · 时长」，点击滚动到对应分镜卡 */}
      <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 3, height: 40 }}>
          {blocks.map((b, i) => {
            const meta = SHOT_KIND_META[b.kind];
            const cum = blocks.slice(0, i).reduce((s, bb) => s + bb.dur, 0);
            // 段太窄时只显示序号+时长，留出 hover tooltip 看全名
            const narrow = b.dur / Math.max(totalDur, 1) < 0.12;
            return (
              <button
                key={i}
                className="mo-seg"
                data-hook={i === 0 ? "true" : undefined}
                title={`镜头 ${i + 1} · ${meta.label} · ${cum}s–${cum + b.dur}s（${b.dur}s）`}
                onClick={() => {
                  const el = document.getElementById(`shot-${i}`);
                  if (!el) return;
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.remove("mo-pulse");
                  void el.offsetWidth; // 重启动画
                  el.classList.add("mo-pulse");
                }}
                style={{
                  flex: b.dur,
                  minWidth: 34,
                  borderRadius: i === 0 ? "6px 3px 3px 6px" : i === blocks.length - 1 ? "3px 6px 6px 3px" : 3,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "flex-start",
                  gap: 1,
                  padding: "4px 8px",
                  overflow: "hidden",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 500, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>
                  {narrow ? i + 1 : `${i + 1} · ${meta.label}`}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, lineHeight: 1, fontVariantNumeric: "tabular-nums", opacity: 0.85 }}>
                  {b.dur}s
                </span>
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>
          <span>0s</span>
          <span>{Math.floor(totalDur / 2)}s</span>
          <span>{totalDur}s · 总时长</span>
        </div>
      </div>

      {/* shot blocks */}
      <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
        {blocks.map((b, i) => (
          <ShotBlock
            key={i}
            index={i}
            block={b}
            total={blocks.length}
            cumDur={blocks.slice(0, i).reduce((s, bb) => s + bb.dur, 0)}
            onUpdate={(patch) => update(i, patch)}
            onMove={(d) => move(i, d)}
            onRemove={() => remove(i)}
            onAction={(k) => onBlockAction(i, k)}
          />
        ))}
        <button
          onClick={() => insert(blocks.length)}
          style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "transparent", border: "1px dashed var(--line-2)", color: "var(--fg-2)", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <Plus size={13} /> 新增镜头 · 在末尾追加
        </button>
      </div>

      {/* topic + cart */}
      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "var(--bg-2)" }}>
        <Eyebrow style={{ marginRight: 4 }}>话题</Eyebrow>
        {PLATFORM_RULES[platform].topics.map((t) => (
          <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", background: hexA("#7c5cff", "14"), padding: "4px 9px", borderRadius: "var(--radius-sm)" }}>
            {t}
          </span>
        ))}
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--fg-1)" }}>
          挂车
          <button
            onClick={() => setDraft({ ...draft, cart: !draft.cart })}
            style={{ width: 34, height: 20, borderRadius: 99, position: "relative", background: draft.cart ? "var(--accent)" : "var(--bg-3)", border: "1px solid var(--line-2)", cursor: "pointer", padding: 0 }}
          >
            <span style={{ position: "absolute", top: 1, left: draft.cart ? 15 : 1, width: 16, height: 16, borderRadius: 99, background: "#fff", transition: "left 140ms" }} />
          </button>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{draft.cart ? "带链接 · 流量减损 ~30%" : "纯曝光 · 完播率优先"}</span>
        </span>
      </div>
    </Card>
  );
}

function ShotBlock({ index, block, cumDur, total, onUpdate, onMove, onRemove, onAction }: { index: number; block: ScriptBlock; cumDur: number; total: number; onUpdate: (p: Partial<ScriptBlock>) => void; onMove: (d: number) => void; onRemove: () => void; onAction: (k: "template" | "viral" | "ai") => void }) {
  const meta = SHOT_KIND_META[block.kind];
  const color = meta.toneVar;
  const flagged = BANNED_WORDS.filter((w) => block.text.includes(w.word)).map((w) => w.word);
  const [pickedWord, setPickedWord] = React.useState<string | null>(null);
  const [kindMenu, setKindMenu] = React.useState(false);

  return (
    <div id={`shot-${index}`} style={{ borderRadius: "var(--radius-md)", overflow: "hidden", background: "var(--bg-2)", border: "1px solid var(--line)", position: "relative", scrollMarginTop: 16 }}>
      {/* left rail */}
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 34, borderRight: "1px solid var(--line)", background: `linear-gradient(180deg, ${hexA(color, "14")} 0%, transparent 30%)`, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", gap: 4 }}>
        <GripVertical size={11} color="var(--fg-3)" />
        <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: hexA(color, "1f"), color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>
          {index + 1}
        </span>
        <button onClick={() => onMove(-1)} disabled={index === 0} style={railBtn(index === 0)}>
          <ChevronUp size={11} />
        </button>
        <button onClick={() => onMove(1)} disabled={index === total - 1} style={railBtn(index === total - 1)}>
          <ChevronDown size={11} />
        </button>
      </div>

      <div style={{ paddingLeft: 34 }}>
        {/* top row */}
        <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", background: hexA(color, "12"), border: `1px solid ${hexA(color, "44")}`, borderRadius: "var(--radius-pill)", padding: "2px 4px 2px 10px", gap: 4 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color, fontVariantNumeric: "tabular-nums" }}>{cumDur}s — {cumDur + block.dur}s</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>·</span>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
              <button onClick={() => onUpdate({ dur: Math.max(1, block.dur - 1) })} style={stepBtn}>−</button>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-0)", minWidth: 26, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{block.dur}s</span>
              <button onClick={() => onUpdate({ dur: block.dur + 1 })} style={stepBtn}>+</button>
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <button onClick={() => setKindMenu(!kindMenu)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: "var(--radius-pill)", background: hexA(color, "12"), border: `1px solid ${hexA(color, "44")}`, color, fontSize: 11, fontFamily: "var(--font-mono)", cursor: "pointer" }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
              {meta.label}
              <ChevronDown size={9} />
            </button>
            {kindMenu && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 10, background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--radius-md)", padding: 4, boxShadow: "var(--shadow-pop)", display: "flex", flexDirection: "column", gap: 1, minWidth: 110 }}>
                {SHOT_KINDS.map((k) => (
                  <button key={k} onClick={() => { onUpdate({ kind: k }); setKindMenu(false); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: block.kind === k ? "var(--bg-2)" : "transparent", border: 0, color: "var(--fg-0)", fontSize: 12, cursor: "pointer", borderRadius: "var(--radius-sm)", textAlign: "left" }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: SHOT_KIND_META[k].toneVar }} />
                    {SHOT_KIND_META[k].label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            value={block.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            style={{ flex: 1, minWidth: 120, background: "transparent", border: 0, color: "var(--fg-0)", fontSize: 14, fontWeight: 500, outline: "none", padding: "2px 0" }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {index === 0 && <Tag color="var(--warning)">黄金 3s</Tag>}
            {flagged.length > 0 && <Tag color="var(--danger)">{flagged.length} 违禁</Tag>}
            {/* 针对单镜的起稿动作（模板层已有同款能力，这里收缩为图标） */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconAction icon={<LayoutTemplate size={13} />} title="套用模板片段" tone="var(--accent)" onClick={() => onAction("template")} />
              <IconAction icon={<Flame size={13} />} title="套用爆款同款" tone="var(--danger)" onClick={() => onAction("viral")} />
              <IconAction icon={<Wand2 size={13} />} title="AI 重写该镜头" tone="var(--extra-teal)" onClick={() => onAction("ai")} />
            </div>
            <span style={{ width: 1, height: 18, background: "var(--line)", margin: "0 2px" }} />
            <Button variant="icon" size="sm" title="删除该镜头" onClick={onRemove} style={{ width: 28, height: 28, padding: 0 }}>
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        {/* body：脚本=画面/分镜（主，更宽，含快捷填入）；字幕=口播语音（可勾选是否生成配音/字幕） */}
        <div className="stack-mobile" style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "minmax(0, 1.9fr) minmax(0, 1fr)", gap: 18 }}>
          {/* 脚本 · 画面 / 分镜 —— 描述视频内容（拍什么、怎么拍） */}
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>脚本 · 画面 / 分镜</Eyebrow>
            <BannedTextarea
              value={block.shot}
              onChange={(v) => onUpdate({ shot: v })}
              placeholder={index === 0 ? "开场画面：场景 / 人物 / 怎么拍（如：近景，主播面对镜头提问）…" : "这一镜画面里发生什么、怎么拍：场景 / 人物动作 / 运镜景别 / 产品如何出现…"}
              minHeight={104}
            />
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {SHOT_QUICK_FILLS.map((t) => (
                <button key={t} onClick={() => onUpdate({ shot: block.shot ? `${block.shot} · ${t}` : t })} style={{ padding: "2px 7px", borderRadius: "var(--radius-sm)", fontSize: 10, background: "var(--bg-1)", color: "var(--fg-2)", border: "1px solid var(--line)", cursor: "pointer", fontFamily: "var(--font-mono)" }}>
                  + {t}
                </button>
              ))}
            </div>
          </div>

          {/* 字幕 · 口播语音 —— 要念出来、显示为字幕的台词；可勾选是否生成 */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
              <Eyebrow>字幕 · 口播语音</Eyebrow>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, color: "var(--fg-2)", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={block.genVoice !== false}
                  onChange={(e) => onUpdate({ genVoice: e.target.checked })}
                  style={{ accentColor: "var(--accent)", width: 12, height: 12 }}
                />
                生成配音/字幕
              </label>
            </div>
            {block.genVoice !== false ? (
              <>
                <BannedTextarea
                  value={block.text}
                  onChange={(v) => onUpdate({ text: v })}
                  placeholder={index === 0 ? "前 3 秒就要勾住观众的台词…试试反差、提问、身份共鸣" : "这一镜要念出来 / 显示为字幕的话…"}
                  flagged={flagged}
                  onFlaggedClick={(w) => setPickedWord(w)}
                  minHeight={72}
                  small
                />
                <div style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", fontVariantNumeric: "tabular-nums" }}>
                  {block.text.length} 字 · 约 {Math.ceil(block.text.length / 4)}s 口播
                </div>
                {pickedWord && (
                  <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: "var(--radius-md)", background: hexA("#ff5b8a", "0d"), border: `1px solid ${hexA("#ff5b8a", "44")}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <TriangleAlert size={12} color="var(--danger)" />
                    <span style={{ fontSize: 11, color: "var(--fg-1)" }}>
                      替换 <strong style={{ color: "var(--danger)" }}>「{pickedWord}」</strong> →
                    </span>
                    {(WORD_SUGGESTIONS[pickedWord] ?? ["请人工修改"]).map((s) => (
                      <button key={s} onClick={() => { onUpdate({ text: block.text.split(pickedWord).join(s) }); setPickedWord(null); }} style={{ padding: "3px 9px", borderRadius: "var(--radius-sm)", fontSize: 11, background: hexA("#22b59a", "1f"), color: "var(--extra-teal)", border: `1px solid ${hexA("#22b59a", "44")}`, cursor: "pointer" }}>
                        {s}
                      </button>
                    ))}
                    <button onClick={() => setPickedWord(null)} style={{ marginLeft: "auto", background: "transparent", border: 0, color: "var(--fg-3)", cursor: "pointer", fontSize: 11 }}>忽略</button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "14px 12px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px dashed var(--line-2)", fontSize: 11, color: "var(--fg-3)", textAlign: "center" }}>
                该镜为纯画面 · 不生成配音 / 字幕
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const railBtn = (disabled: boolean): React.CSSProperties => ({ width: 22, height: 18, borderRadius: 4, background: "transparent", border: 0, color: "var(--fg-3)", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1, display: "flex", alignItems: "center", justifyContent: "center" });
const stepBtn: React.CSSProperties = { width: 18, height: 18, borderRadius: 4, background: "var(--bg-1)", border: "1px solid var(--line-2)", color: "var(--fg-1)", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: 0 };

// 单镜起稿动作：仅图标的 ghost 按钮，hover 揭示语义色 + 原生 tooltip 说明。
function IconAction({ icon, title, tone, onClick }: { icon: React.ReactNode; title: string; tone: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className="mo-ghost"
      style={{ ["--mo-tone" as string]: tone, display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, padding: 0, borderRadius: "var(--radius-sm)", cursor: "pointer" }}
    >
      {icon}
    </button>
  );
}

// 违禁词高亮 textarea（背景层叠高亮 + 可点）
function BannedTextarea({ value, onChange, placeholder, flagged = [], onFlaggedClick, minHeight = 64, small }: { value: string; onChange: (v: string) => void; placeholder?: string; flagged?: string[]; onFlaggedClick?: (w: string) => void; minHeight?: number; small?: boolean }) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  React.useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value]);
  const fontSize = small ? 12 : 13.5;
  return (
    <div className="mo-well" style={{ position: "relative" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, padding: "8px 10px", fontSize, lineHeight: 1.75, fontFamily: "var(--font-sans)", color: "transparent", whiteSpace: "pre-wrap", wordBreak: "break-word", pointerEvents: flagged.length ? "auto" : "none" }}>
        {renderFlagged(value, flagged, onFlaggedClick)}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={1}
        style={{ position: "relative", width: "100%", resize: "none", overflow: "hidden", background: "transparent", border: 0, padding: "8px 10px", borderRadius: "var(--radius-sm)", color: "var(--fg-0)", fontFamily: "var(--font-sans)", fontSize, lineHeight: 1.75, outline: "none", minHeight }}
      />
    </div>
  );
}

function renderFlagged(text: string, flagged: string[], onClick?: (w: string) => void): React.ReactNode {
  if (!flagged.length) return text;
  let parts: ({ t: string } | { f: string })[] = [{ t: text }];
  flagged.forEach((w) => {
    const next: typeof parts = [];
    parts.forEach((p) => {
      if ("f" in p) {
        next.push(p);
        return;
      }
      const split = p.t.split(w);
      split.forEach((s, i) => {
        if (i > 0) next.push({ f: w });
        if (s) next.push({ t: s });
      });
    });
    parts = next;
  });
  return parts.map((p, i) =>
    "t" in p ? (
      <span key={i}>{p.t}</span>
    ) : (
      <span key={i} onClick={() => onClick?.(p.f)} style={{ background: hexA("#ff5b8a", "33"), color: "var(--danger)", borderBottom: "1.5px solid var(--danger)", borderRadius: 2, cursor: "pointer", pointerEvents: "auto" }}>
        {p.f}
      </span>
    ),
  );
}

// ── 镜头级动作抽屉（套模板 / 套同款 / AI 重写） ───────────────────────────────
function BlockDrawer({ draft, setDraft, product, blockIndex, kind, onClose }: { draft: ScriptAsset; setDraft: (d: ScriptAsset) => void; product: MaterialProduct; blockIndex: number; kind: "template" | "viral" | "ai"; onClose: () => void }) {
  const block = draft.blocks[blockIndex];
  const apply = (text: string) => {
    setDraft({ ...draft, blocks: draft.blocks.map((b, i) => (i === blockIndex ? { ...b, text } : b)) });
    onClose();
  };
  const meta = { template: { title: "套用模板片段", tone: "var(--accent)" }, viral: { title: "套用爆款同款", tone: "var(--danger)" }, ai: { title: "AI 重写该镜头", tone: "var(--extra-teal)" } }[kind];

  let body: React.ReactNode = null;
  if (kind === "template") {
    const snippets = BLOCK_SNIPPETS[block.kind] ?? BLOCK_SNIPPETS.hook;
    body = (
      <div>
        {snippets.map((s) => (
          <button key={s.id} onClick={() => apply(s.text)} style={drawerRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <TierBadge tier={s.tier} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{s.type}</span>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--extra-teal)", fontWeight: 700 }}>CTR {s.perf}%</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-0)", lineHeight: 1.6 }}>{s.text}</div>
          </button>
        ))}
      </div>
    );
  } else if (kind === "viral") {
    body = (
      <div>
        {VIRAL_HITS.map((h) => (
          <div key={h.id} style={{ padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--extra-teal)", fontWeight: 700 }}>{h.score}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {h.structure.slice(0, 4).map((s, i) => (
                <button key={i} onClick={() => apply(s.text)} style={{ padding: "6px 8px", borderRadius: "var(--radius-sm)", cursor: "pointer", background: "var(--bg-2)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 2, minWidth: 0, textAlign: "left" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--danger)" }}>{s.t} · {s.tag}</span>
                  <span style={{ fontSize: 11, color: "var(--fg-1)", lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  } else {
    const candidates = aiBlockCandidates(block.kind, product.name);
    body = (
      <div>
        {candidates.map((c, i) => (
          <button key={i} onClick={() => apply(c.text)} style={drawerRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <Tag color="var(--extra-teal)" style={{ fontSize: 9, padding: "2px 6px" }}>候选 {i + 1}</Tag>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{c.angle}</span>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--extra-teal)", fontWeight: 700 }}>~{c.score}%</span>
            </div>
            <div style={{ fontSize: 13, color: "var(--fg-0)", lineHeight: 1.6 }}>{c.text}</div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 80 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 460, zIndex: 90, background: "var(--bg-1)", borderLeft: "1px solid var(--line)", boxShadow: "var(--shadow-pop)", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 12, background: `linear-gradient(135deg, ${hexA(meta.tone === "var(--accent)" ? "#7c5cff" : meta.tone === "var(--danger)" ? "#ff5b8a" : "#22b59a", "12")}, transparent 60%)` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 600 }}>{meta.title}</div>
            <div style={{ fontSize: 11, color: "var(--fg-2)", marginTop: 2 }}>为镜头 {blockIndex + 1} 选一个候选</div>
          </div>
          <Button variant="icon" size="sm" onClick={onClose} style={{ width: 32, padding: 0 }}>
            <X size={14} />
          </Button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>{body}</div>
      </div>
    </>
  );
}

const drawerRow: React.CSSProperties = { width: "100%", textAlign: "left", padding: "12px 18px", borderBottom: "1px solid var(--line)", cursor: "pointer", background: "transparent", fontFamily: "var(--font-sans)" };

function aiBlockCandidates(kind: ShotKind, pn: string): { text: string; angle: string; score: number }[] {
  const pool: Record<ShotKind, { text: string; angle: string; score: number }[]> = {
    hook: [
      { text: `修了 30 年车，第一次给老婆买${pn}`, angle: "蓝领情感", score: 78 },
      { text: `"229 块钱让她每天舒服 20 分钟" · 值`, angle: "价格反差", score: 71 },
      { text: `老婆颈椎不好，我能想到最贴心的礼物就是${pn}`, angle: "直接表白", score: 62 },
    ],
    emotion: [
      { text: "冬日早晨 · 老婆赖床揉脖子的特写慢镜", angle: "场景共鸣", score: 74 },
      { text: "闺女悄悄拍：爸爸的手机停在购物车", angle: "父女视角", score: 81 },
    ],
    product: [
      { text: `镜头怼盒子 · 老婆惊呼："你不是去修车了？"`, angle: "惊喜揭示", score: 76 },
      { text: "开箱节奏：拆封 → 充电 → 试用 · 4 个特写", angle: "产品节奏", score: 72 },
    ],
    effect: [
      { text: '老婆戴上 · 边吃饭边按 · "舒服死了"', angle: "体感真实", score: 80 },
      { text: "用了 30 天的时间轴：揉脖子 → 不揉了", angle: "时间对比", score: 74 },
    ],
    cta: [
      { text: '"老婆说有需要的姐妹评论区扣 1，给你们要链接"', angle: "评论引导", score: 76 },
      { text: '购物车小黄车 + "今天直播间还有 50 单"', angle: "紧迫挂车", score: 72 },
    ],
    scene: [
      { text: "厨房 vlog 视角 · 烧水 · 倒燕麦 · 自然光", angle: "场景搭建", score: 70 },
      { text: "试衣镜 360 度展示 · 弹幕飘过", angle: "展示", score: 66 },
    ],
  };
  return pool[kind] ?? pool.hook;
}

// ── Agent Panel ──────────────────────────────────────────────────────────────
function AgentPanel({ draft, platform, setPlatform }: { draft: ScriptAsset; platform: PlatformId; setPlatform: (p: PlatformId) => void }) {
  const blocks = draft.blocks;
  const totalFlags = blocks.reduce((s, b) => s + BANNED_WORDS.filter((w) => b.text.includes(w.word)).length, 0);
  const hookText = blocks[0]?.text ?? "";
  const hookScore = Math.min(92, 55 + Math.min(hookText.length, 40));
  const rules = PLATFORM_RULES[platform];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 8 }}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <Eyebrow>智能体校验 · 平台适配</Eyebrow>
        </div>
        <div style={{ padding: "10px 10px 14px" }}>
          <div className="stack-mobile-2" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
            {(Object.keys(PLATFORM_RULES) as PlatformId[]).map((id) => {
              const active = platform === id;
              return (
                <button key={id} onClick={() => setPlatform(id)} style={{ padding: "10px 4px", borderRadius: "var(--radius-md)", cursor: "pointer", background: active ? hexA("#7c5cff", "1f") : "transparent", border: `1px solid ${active ? "var(--accent)" : "transparent"}`, textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: active ? "var(--fg-0)" : "var(--fg-2)" }}>{PLATFORM_RULES[id].name}</div>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", fontSize: 11.5, color: "var(--fg-1)", lineHeight: 1.6 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", letterSpacing: "0.06em", marginBottom: 4 }}>
              甜区时长 {rules.duration_sweet} · 钩子窗口 {rules.hook_window}s
            </div>
            {rules.notes}
          </div>
        </div>
      </Card>

      <Card style={{ padding: 18 }}>
        <Eyebrow>实时评分</Eyebrow>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          <ScoreRow label="钩子强度" value={hookScore} max={100} tone="var(--accent)" hint="情感反差类钩子在抖音命中率高" />
          <ScoreRow label="完播率预估" value={64} max={100} tone="var(--extra-teal)" hint="基于结构 + 时长 + 类目历史" />
          <ScoreRow label="互动率预估" value={5.8} max={10} suffix="%" tone="var(--extra-teal)" hint="情感共鸣 + CTA 明确" />
          <ScoreRow label="转化分" value={draft.cart ? 72 : 38} max={100} tone="var(--warning)" hint={draft.cart ? "挂车流量减损但转化高" : "纯曝光建议先测互动"} />
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--line)", background: totalFlags > 0 ? hexA("#ff5b8a", "0d") : "transparent" }}>
          <Eyebrow>合规检测 · 违禁词</Eyebrow>
          <Tag color={totalFlags > 0 ? "var(--danger)" : "var(--extra-teal)"}>{totalFlags > 0 ? `${totalFlags} 处待修` : "通过"}</Tag>
        </div>
        <div style={{ padding: 14 }}>
          {BANNED_WORDS.filter((w) => w.count > 0).slice(0, 4).map((w) => (
            <div key={w.word} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px dashed var(--line)" }}>
              <span style={{ fontSize: 12, color: "var(--danger)", background: hexA("#ff5b8a", "14"), padding: "2px 9px", borderRadius: "var(--radius-sm)", fontWeight: 500 }}>{w.word}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", flex: 1 }}>
                {w.tier === "hard" ? "极限词 · 强阻断" : w.tier === "medical" ? "医疗效果 · 慎用" : "违规候选"}
              </span>
            </div>
          ))}
          <Button variant="secondary" size="sm" style={{ width: "100%", marginTop: 12 }}>
            <ShieldCheck size={12} /> 一键智能改写
          </Button>
        </div>
      </Card>

      <Card style={{ padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Eyebrow>历史相似度 · 去重</Eyebrow>
          <Tag color="var(--warning)">72%</Tag>
        </div>
        <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--fg-1)", lineHeight: 1.6 }}>
          与近 30 天 <strong style={{ color: "var(--fg-0)" }}>3 条脚本</strong> 结构相似 · 建议提升差异度至 80%+
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {[
            { id: "s-2491", sim: 78, title: "修车老李 · 颈椎按摩" },
            { id: "s-2477", sim: 64, title: "情感种草 · 母亲节款" },
            { id: "s-2458", sim: 58, title: "蓝领送礼 · 按摩仪测评" },
          ].map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", fontSize: 11.5 }}>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)", fontSize: 10 }}>{s.id}</span>
              <span style={{ flex: 1, color: "var(--fg-1)" }}>{s.title}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: s.sim > 70 ? "var(--danger)" : "var(--warning)", fontSize: 11 }}>{s.sim}%</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScoreRow({ label, value, max, tone, suffix, hint }: { label: string; value: number; max: number; tone: string; suffix?: string; hint?: string }) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: "var(--fg-1)" }}>{label}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}>
          {value}
          {suffix ?? ""}
          <span style={{ color: "var(--fg-3)", fontSize: 10, marginLeft: 2, fontWeight: 400 }}>/{max}{suffix ?? ""}</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 4, marginTop: 6, background: "var(--bg-3)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: "var(--radius-pill)", background: tone }} />
      </div>
      {hint && <div style={{ fontSize: 10.5, color: "var(--fg-3)", marginTop: 5 }}>{hint}</div>}
    </div>
  );
}
