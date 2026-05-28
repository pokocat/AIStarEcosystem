"use client";

// 脚本预览 —— 结构化预览 ↔ Prompt 预览（字段对照 / 完整提示词 / 给 AI 的数据包）。
// 从脚本库点击进入；预览底部进入视频渲染。

import * as React from "react";
import { ChevronRight, Edit3, PlayCircle, Copy, Lock } from "lucide-react";
import { Card, Button } from "@/components/creator";
import { VIDEO_ASSETS } from "@/mocks/material-ops";
import { SHOT_KIND_META, ASSET_KIND_META, PLATFORM_RULES } from "@/constants/material-ops-ui";
import type { MaterialProduct, ScriptAsset, ScriptBlock } from "./types";
import { Eyebrow, Tag, Seg, TierBadge, MetricTile, FilterChip, hexA } from "./shared";
import { PromptView } from "./PromptView";

export function ScriptPreview({
  script,
  product,
  isFromLibrary,
  onBack,
  onEdit,
  onGenerateVideo,
}: {
  script: ScriptAsset;
  product: MaterialProduct;
  isFromLibrary?: boolean;
  onBack: () => void;
  onEdit: () => void;
  onGenerateVideo: () => void;
}) {
  const kindMeta = ASSET_KIND_META[script.kind];
  const blocks = script.blocks;
  const totalDur = blocks.reduce((s, b) => s + b.dur, 0);
  const relatedVideos = VIDEO_ASSETS.filter((v) => v.script_id === script.id);
  const isReadOnly = !!isFromLibrary && script.kind !== "my_script";
  const [viewMode, setViewMode] = React.useState<"structured" | "prompt">("structured");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1280 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Button variant="ghost" onClick={onBack}>
          <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} /> 返回脚本库
        </Button>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Seg value={viewMode} onChange={setViewMode} options={[{ value: "structured", label: "结构化预览" }, { value: "prompt", label: "Prompt 预览" }]} />
          <span style={{ width: 1, height: 24, background: "var(--line-2)" }} />
          {isReadOnly ? (
            <>
              <Button variant="secondary" size="md">
                <Copy size={13} /> 复制到我的脚本
              </Button>
              <Button variant="accent" size="md" onClick={onGenerateVideo}>
                <PlayCircle size={14} /> 直接生成视频 →
              </Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="md" onClick={onEdit}>
                <Edit3 size={13} /> 编辑脚本
              </Button>
              <Button variant="accent" size="md" onClick={onGenerateVideo}>
                <PlayCircle size={14} /> 生成视频 →
              </Button>
            </>
          )}
        </div>
      </div>

      {viewMode === "prompt" ? (
        <PromptView script={script} product={product} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 18, alignItems: "flex-start" }}>
          {/* center */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Card style={{ padding: 0, overflow: "hidden", background: `linear-gradient(135deg, ${hexA(script.cover_color, "14")} 0%, transparent 50%), var(--bg-1)` }}>
              <div style={{ padding: "22px 26px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <Eyebrow>脚本预览</Eyebrow>
                  <Tag color={kindMeta.toneVar}>{kindMeta.label}</Tag>
                  <TierBadge tier={script.tier} />
                  {isReadOnly && <Tag color="var(--fg-2)"><Lock size={9} /> 只读 · 模板</Tag>}
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" }}>{script.id}</span>
                </div>
                <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, color: "var(--fg-0)", fontWeight: 700, margin: 0, letterSpacing: "-0.015em" }}>{script.name}</h1>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 10, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", flexWrap: "wrap" }}>
                  <span>{script.source?.author}</span>
                  <span>·</span>
                  <span>{script.category} · {script.hook_type}</span>
                  <span>·</span>
                  <span>{totalDur}s · {blocks.length} 镜</span>
                </div>
              </div>
              <div style={{ padding: "12px 26px 18px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                <QuickMeta label="时长" value={`${totalDur}s`} />
                <QuickMeta label="镜头数" value={String(blocks.length)} />
                <QuickMeta label="商品" value={`${product.emoji} ${product.name}`} />
                <QuickMeta label="钩子类型" value={script.hook_type} />
                <QuickMeta label="受众" value={(script.audience ?? ["通用"])[0]} />
                <QuickMeta label="平台" value={(script.platforms ?? ["douyin"]).join(" / ")} />
              </div>
            </Card>

            {/* linked product */}
            <Card style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
              <Eyebrow style={{ width: 70 }}>关联商品</Eyebrow>
              <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", flexShrink: 0, background: `linear-gradient(135deg, ${product.accentColor}, ${hexA(product.accentColor ?? "#7c5cff", "99")})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                {product.emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 500 }}>{product.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  <Tag color="var(--fg-2)">{product.category}</Tag>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--extra-teal)", fontWeight: 600 }}>{product.priceCents ? `¥${(product.priceCents / 100).toFixed(0)}` : "—"}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--warning)" }}>佣金 {product.commissionRate ?? "—"}%</span>
                </div>
              </div>
            </Card>

            {/* 5-shot body */}
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Eyebrow>5 镜头剧本 · 镜头表</Eyebrow>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>总时长 {totalDur}s</span>
              </div>
              <div>
                {blocks.map((b, i) => (
                  <PreviewShot key={i} block={b} idx={i} cumDur={blocks.slice(0, i).reduce((s, bb) => s + bb.dur, 0)} product={product} onEdit={!isReadOnly ? onEdit : undefined} />
                ))}
              </div>
            </Card>
          </div>

          {/* right rail */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, position: "sticky", top: 8 }}>
            {script.metrics.uses_count > 0 && (
              <Card style={{ padding: 18 }}>
                <Eyebrow style={{ marginBottom: 12 }}>历史表现</Eyebrow>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <MetricTile label="平均 CTR" value={`${script.metrics.ctr_pct}%`} tone="var(--extra-teal)" />
                  <MetricTile label="完播率" value={`${script.metrics.completion_pct}%`} tone="var(--extra-teal)" />
                  <MetricTile label="差异度" value={`${script.metrics.diversity_pct}%`} tone="var(--accent)" />
                  <MetricTile label="历史复用" value={script.metrics.uses_count} tone="var(--warning)" />
                </div>
                {script.metrics.best_video && (
                  <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: "var(--radius-md)", background: hexA("#22b59a", "0d"), border: `1px solid ${hexA("#22b59a", "33")}` }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--extra-teal)", letterSpacing: "0.1em" }}>最佳表现视频</div>
                    <div style={{ fontSize: 12, color: "var(--fg-0)", marginTop: 4 }}>
                      {script.metrics.best_video.plays} 播放 · {script.metrics.best_video.gmv}
                    </div>
                  </div>
                )}
              </Card>
            )}

            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Eyebrow>已派生视频</Eyebrow>
                <Tag color="var(--accent)">{relatedVideos.length}</Tag>
              </div>
              <div style={{ padding: 12 }}>
                {relatedVideos.length === 0 && (
                  <div style={{ padding: "14px 12px", textAlign: "center", borderRadius: "var(--radius-md)", background: hexA("#22b59a", "0d"), border: `1px dashed ${hexA("#22b59a", "44")}`, fontSize: 11.5, color: "var(--fg-1)", lineHeight: 1.6 }}>
                    尚未生成视频
                    <br />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--extra-teal)" }}>点击“生成视频”开始 →</span>
                  </div>
                )}
                {relatedVideos.map((v) => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
                    <div style={{ width: 32, height: 42, borderRadius: 5, flexShrink: 0, background: `linear-gradient(180deg, ${hexA(v.cover_color, "99")}, ${hexA(v.cover_color, "33")})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                      {v.thumb_emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 2 }}>
                        {v.kind === "baseline" ? "基线" : "变体"} · {v.duration_sec}s
                        {v.metrics && <> · <span style={{ color: "var(--extra-teal)" }}>{v.metrics.ctr_pct}%</span></>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card style={{ padding: 16 }}>
              <Eyebrow style={{ marginBottom: 10 }}>受众适配</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                {(script.audience ?? []).map((a) => (
                  <FilterChip key={a}>{a}</FilterChip>
                ))}
              </div>
              <Eyebrow style={{ marginBottom: 10 }}>分发平台</Eyebrow>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                {(script.platforms ?? []).map((p) => {
                  const pm = PLATFORM_RULES[p];
                  return pm ? <Tag key={p} color={pm.color}>{pm.name}</Tag> : null;
                })}
              </div>
              <Eyebrow style={{ marginBottom: 10 }}>标签</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {script.tags.map((t) => (
                  <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", background: hexA("#7c5cff", "14"), padding: "2px 6px", borderRadius: "var(--radius-sm)" }}>#{t}</span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickMeta({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500 }}>{value}</span>
    </span>
  );
}

function PreviewShot({ block, idx, cumDur, product, onEdit }: { block: ScriptBlock; idx: number; cumDur: number; product: MaterialProduct; onEdit?: () => void }) {
  const tone = SHOT_KIND_META[block.kind].toneVar;
  const [hovered, setHovered] = React.useState(false);
  const displayText = block.kind === "product" ? block.text.replace(/精华瓶|按摩仪|产品袋|打底/g, product.name) : block.text;
  return (
    <div
      onClick={onEdit}
      onMouseEnter={() => onEdit && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ padding: "14px 22px", display: "flex", alignItems: "flex-start", gap: 14, borderBottom: "1px solid var(--line)", cursor: onEdit ? "pointer" : "default", background: hovered ? hexA("#7c5cff", "0a") : "transparent", transition: "background 140ms" }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, paddingTop: 2, minWidth: 56 }}>
        <span style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: hexA(tone, "1f"), color: tone, fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{idx + 1}</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: tone, padding: "1px 5px", borderRadius: 3, background: hexA(tone, "12"), border: `1px solid ${hexA(tone, "33")}`, whiteSpace: "nowrap" }}>{cumDur}-{cumDur + block.dur}s</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 14, color: "var(--fg-0)", fontWeight: 500 }}>{block.label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>{block.dur}s</span>
          {hovered && (
            <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)" }}>
              <Edit3 size={10} /> 点击编辑
            </span>
          )}
        </div>
        <div style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.7, marginBottom: 6 }}>{displayText}</div>
        {block.shot && (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", background: "var(--bg-2)", padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {block.shot}
          </div>
        )}
      </div>
    </div>
  );
}
