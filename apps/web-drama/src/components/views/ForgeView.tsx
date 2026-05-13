"use client";

// 形象锻造炉 · cinematic 三列布局：
//   左侧 1.1 — 参数面板（演员选择、提示词、风格、镜头、光线、年龄段）
//   中间 2.0 — 大幅预览（16:9 渐变占位 + 提示词摘要 + 操作条）
//   右侧 1.0 — 版本历史（缩略图列表，可切换为主预览）

import * as React from "react";
import {
  Aperture,
  ChevronDown,
  Crown,
  Download,
  Image as ImageIcon,
  Info,
  Loader2,
  Lock,
  Palette,
  Sparkles,
  Star,
  Trash2,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import { Button, Card, Chip } from "@/components/premium";
import { QUALITY_GRADIENT, QUALITY_LABEL, QUALITY_TONE } from "@/lib/cast-derive";

interface Props {
  artists: Artist[];
}

const STYLE_OPTIONS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "modern", label: "都市现代", icon: Aperture },
  { id: "classic", label: "古风武侠", icon: Crown },
  { id: "cyberpunk", label: "赛博朋克", icon: Sparkles },
  { id: "studio", label: "影楼写真", icon: Palette },
];

const SHOT_OPTIONS = [
  { id: "close", label: "近景特写" },
  { id: "medium", label: "中景半身" },
  { id: "wide", label: "远景全身" },
];

const LIGHT_OPTIONS = [
  { id: "day", label: "日光自然" },
  { id: "dusk", label: "黄昏柔光" },
  { id: "studio", label: "影棚高光" },
  { id: "night", label: "夜景冷调" },
];

interface ForgeVersion {
  id: string;
  versionLabel: string;
  prompt: string;
  style: string;
  shot: string;
  light: string;
  generatedAt: string;
  durationMs: number;
  isOfficial?: boolean;
}

const SEED_VERSIONS: ForgeVersion[] = [
  { id: "v3", versionLabel: "v3 · 官方形象", prompt: "都市悬疑女主，黑色风衣 + 利落短发，雨夜街头", style: "modern", shot: "medium", light: "night", generatedAt: "2 小时前", durationMs: 28_400, isOfficial: true },
  { id: "v2", versionLabel: "v2 · 古装备选", prompt: "古风长裙红衣 + 长剑，月夜竹林", style: "classic", shot: "wide", light: "dusk", generatedAt: "昨天 16:20", durationMs: 31_900 },
  { id: "v1", versionLabel: "v1 · 试用稿", prompt: "校服日系少女，校园樱花树下", style: "studio", shot: "close", light: "day", generatedAt: "3 天前", durationMs: 22_500 },
];

const STYLE_BG: Record<string, string> = {
  modern: "linear-gradient(135deg, rgba(212,175,106,0.45), rgba(86,81,106,0.6))",
  classic: "linear-gradient(135deg, rgba(255,61,138,0.4), rgba(212,175,106,0.5))",
  cyberpunk: "linear-gradient(135deg, rgba(164,76,255,0.55), rgba(61,224,255,0.4))",
  studio: "linear-gradient(135deg, rgba(234,215,168,0.5), rgba(212,175,106,0.4))",
};

export function ForgeView({ artists }: Props) {
  const [activeArtistId, setActiveArtistId] = React.useState(artists[0]?.id ?? "");
  const [prompt, setPrompt] = React.useState(SEED_VERSIONS[0].prompt);
  const [negativePrompt, setNegativePrompt] = React.useState("低分辨率，模糊，扭曲");
  const [style, setStyle] = React.useState(SEED_VERSIONS[0].style);
  const [shot, setShot] = React.useState(SEED_VERSIONS[0].shot);
  const [light, setLight] = React.useState(SEED_VERSIONS[0].light);
  const [age, setAge] = React.useState(28);
  const [versions, setVersions] = React.useState<ForgeVersion[]>(SEED_VERSIONS);
  const [activeVersionId, setActiveVersionId] = React.useState(SEED_VERSIONS[0].id);
  const [generating, setGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const activeArtist = artists.find((a) => a.id === activeArtistId) ?? artists[0];
  const activeVersion = versions.find((v) => v.id === activeVersionId) ?? versions[0];

  React.useEffect(() => {
    if (!generating) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + 8;
        if (next >= 100) {
          clearInterval(interval);
          completeGenerate();
          return 100;
        }
        return next;
      });
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generating]);

  function completeGenerate() {
    const id = `v${versions.length + 1}`;
    const newVersion: ForgeVersion = {
      id,
      versionLabel: `v${versions.length + 1} · 新版本`,
      prompt,
      style,
      shot,
      light,
      generatedAt: "刚刚",
      durationMs: 24_500 + Math.round(Math.random() * 8_000),
    };
    setVersions((vs) => [newVersion, ...vs]);
    setActiveVersionId(id);
    setGenerating(false);
  }

  function setOfficial(id: string) {
    setVersions((vs) => vs.map((v) => ({ ...v, isOfficial: v.id === id })));
  }

  function deleteVersion(id: string) {
    setVersions((vs) => {
      const next = vs.filter((v) => v.id !== id);
      if (activeVersionId === id && next.length > 0) {
        setActiveVersionId(next[0].id);
      }
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 标题 + 演员选择 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div className="eyebrow">演员形象 · 视觉锻造</div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: "10px 0 8px",
              lineHeight: 1.05,
            }}
          >
            形象{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              锻造炉
            </span>
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>
            为已签约演员定义视觉造型 · 单次锻造耗时约 25 秒
          </div>
        </div>
        <ArtistPicker
          artists={artists}
          activeId={activeArtistId}
          onSelect={setActiveArtistId}
        />
      </div>

      {/* 三列主体 */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 2fr 1fr", gap: 18 }}>
        {/* 左侧参数面板 */}
        <Card style={{ padding: "22px 24px" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>提示词</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例：都市悬疑女主，黑色风衣 + 利落短发，雨夜街头"
            style={{ ...textareaStyle, height: 100 }}
          />
          <div className="eyebrow" style={{ marginTop: 18, marginBottom: 8 }}>反向提示词（可选）</div>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="例：低分辨率，模糊，扭曲"
            style={{ ...textareaStyle, height: 60 }}
          />

          <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>风格基调</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {STYLE_OPTIONS.map((s) => {
              const Icon = s.icon;
              const active = style === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  style={chipPicker(active)}
                >
                  <Icon size={14} color={active ? "var(--accent)" : "var(--fg-2)"} />
                  {s.label}
                </button>
              );
            })}
          </div>

          <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>镜头</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {SHOT_OPTIONS.map((o) => {
              const active = shot === o.id;
              return (
                <button key={o.id} onClick={() => setShot(o.id)} style={pillPicker(active)}>
                  {o.label}
                </button>
              );
            })}
          </div>

          <div className="eyebrow" style={{ marginTop: 22, marginBottom: 10 }}>光线</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {LIGHT_OPTIONS.map((o) => {
              const active = light === o.id;
              return (
                <button key={o.id} onClick={() => setLight(o.id)} style={pillPicker(active)}>
                  {o.label}
                </button>
              );
            })}
          </div>

          <div className="eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>
            年龄段（{age} 岁）
          </div>
          <input
            type="range"
            min={16}
            max={55}
            value={age}
            onChange={(e) => setAge(Number(e.target.value))}
            style={rangeStyle}
          />

          <div style={{ marginTop: 26 }}>
            <Button
              variant="primary"
              size="lg"
              onClick={() => setGenerating(true)}
              disabled={generating || prompt.trim().length < 4}
              style={{ width: "100%" }}
            >
              {generating ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> 锻造中…
                </>
              ) : (
                <>
                  <Wand2 size={14} /> 开始锻造
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* 中间大预览 */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              flex: 1,
              minHeight: 460,
              background: STYLE_BG[style] ?? STYLE_BG.modern,
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* 渐变叠层（影院级） */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(circle at 70% 30%, rgba(255,255,255,0.18), transparent 50%)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7))",
              }}
            />

            {/* 顶部 chip */}
            <div style={{ position: "absolute", top: 18, left: 18, display: "flex", gap: 8 }}>
              <Chip tone={QUALITY_TONE[activeArtist?.quality ?? "common"]}>
                {QUALITY_LABEL[activeArtist?.quality ?? "common"]}
              </Chip>
              <Chip tone={activeVersion?.isOfficial ? "accent" : "neutral"}>
                {activeVersion?.versionLabel}
              </Chip>
            </div>

            <div style={{ position: "absolute", top: 18, right: 18 }}>
              <span
                className="mono"
                style={{ fontSize: 10, color: "rgba(255,255,255,0.7)", letterSpacing: 0.6 }}
              >
                1024 × 1820 · 16 : 9
              </span>
            </div>

            {/* 锻造中遮罩 */}
            {generating && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(10,8,16,0.65)",
                  backdropFilter: "blur(4px)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 18,
                }}
              >
                <Loader2 size={36} className="animate-spin" color="var(--accent)" />
                <div
                  className="mono"
                  style={{ fontSize: 12, color: "var(--fg-1)", letterSpacing: 0.6 }}
                >
                  锻造中 · {progress}%
                </div>
                <div
                  style={{
                    width: 280,
                    height: 4,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${progress}%`,
                      height: "100%",
                      background: "var(--gradient-gold)",
                      transition: "width 240ms ease",
                    }}
                  />
                </div>
              </div>
            )}

            {/* 底部信息 */}
            <div style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 700,
                  fontFamily: "var(--font-display)",
                  color: "var(--fg-0)",
                }}
              >
                {activeArtist?.name ?? "未选择演员"}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.85)",
                  marginTop: 6,
                  fontFamily: "var(--font-serif)",
                  fontStyle: "italic",
                  lineHeight: 1.5,
                }}
              >
                "{activeVersion?.prompt ?? prompt}"
              </div>
            </div>
          </div>

          {/* 操作条 */}
          <div
            style={{
              padding: "14px 20px",
              borderTop: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)", letterSpacing: 0.4 }}>
              耗时 {((activeVersion?.durationMs ?? 0) / 1000).toFixed(1)} 秒 · {activeVersion?.generatedAt}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="ghost" size="sm">
                <Download size={13} /> 下载
              </Button>
              <Button
                variant={activeVersion?.isOfficial ? "secondary" : "primary"}
                size="sm"
                onClick={() => activeVersion && setOfficial(activeVersion.id)}
                disabled={!activeVersion}
              >
                {activeVersion?.isOfficial ? (
                  <>
                    <Lock size={13} /> 当前官方形象
                  </>
                ) : (
                  <>
                    <Star size={13} /> 设为官方形象
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>

        {/* 右侧版本历史 */}
        <Card glass style={{ padding: "22px 22px" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>版本历史</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {versions.map((v) => {
              const active = activeVersionId === v.id;
              return (
                <div
                  key={v.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 10,
                    borderRadius: "var(--radius-md)",
                    background: active
                      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                      : "rgba(255,255,255,0.02)",
                    border: active
                      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                      : "1px solid var(--line)",
                    cursor: "pointer",
                    transition: "background 160ms, border-color 160ms",
                  }}
                  onClick={() => setActiveVersionId(v.id)}
                >
                  <div
                    style={{
                      width: 56,
                      height: 78,
                      borderRadius: "var(--radius-sm)",
                      background: STYLE_BG[v.style] ?? STYLE_BG.modern,
                      flexShrink: 0,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55))",
                      }}
                    />
                    {v.isOfficial && (
                      <div
                        style={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          background: "var(--gradient-gold)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Crown size={9} color="#1a1410" />
                      </div>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: active ? "var(--accent)" : "var(--fg-0)",
                        fontFamily: "var(--font-display)",
                        marginBottom: 4,
                      }}
                    >
                      {v.versionLabel}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--fg-2)",
                        lineHeight: 1.4,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {v.prompt}
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 10,
                        color: "var(--fg-3)",
                        marginTop: 6,
                        letterSpacing: 0.3,
                      }}
                    >
                      {v.generatedAt}
                    </div>
                  </div>
                  {!v.isOfficial && versions.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteVersion(v.id);
                      }}
                      title="删除版本"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--fg-3)",
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: 22,
              padding: "12px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid var(--line)",
              fontSize: 11,
              color: "var(--fg-2)",
              lineHeight: 1.6,
              display: "flex",
              gap: 8,
            }}
          >
            <Info size={12} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              点击缩略切换主预览。设为官方形象后，该版本将作为演员对外公开档案的默认头像与卡面背景。
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── 子组件 ──────────────────────────────────────────────────────────────

function ArtistPicker({
  artists,
  activeId,
  onSelect,
}: {
  artists: Artist[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const active = artists.find((a) => a.id === activeId) ?? artists[0];
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-md)",
          color: "var(--fg-0)",
          cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: QUALITY_GRADIENT[active?.quality ?? "common"],
          }}
        />
        <div style={{ textAlign: "left", lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{active?.name ?? "选择演员"}</div>
          <div className="mono" style={{ fontSize: 10, color: "var(--fg-2)", letterSpacing: 0.4 }}>
            {QUALITY_LABEL[active?.quality ?? "common"]}
          </div>
        </div>
        <ChevronDown size={14} color="var(--fg-2)" />
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 30 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              right: 0,
              width: 280,
              maxHeight: 360,
              overflowY: "auto",
              background: "var(--bg-1)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-md)",
              zIndex: 31,
              padding: 8,
            }}
          >
            {artists.map((a) => {
              const isActive = a.id === activeId;
              return (
                <button
                  key={a.id}
                  onClick={() => {
                    onSelect(a.id);
                    setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 10,
                    borderRadius: "var(--radius-sm)",
                    background: isActive ? "rgba(212,175,106,0.10)" : "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--fg-0)",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: QUALITY_GRADIENT[a.quality],
                    }}
                  />
                  <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: isActive ? 600 : 500 }}>{a.name}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.3 }}>
                      {QUALITY_LABEL[a.quality]} · LV {a.level}
                    </div>
                  </div>
                  {isActive && <ImageIcon size={12} color="var(--accent)" />}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─── helper styles ──────────────────────────────────────────────────────

const textareaStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(0,0,0,0.3)",
  border: "1px solid var(--line-2)",
  borderRadius: "var(--radius-md)",
  padding: "10px 12px",
  color: "var(--fg-0)",
  fontSize: 12.5,
  fontFamily: "var(--font-sans)",
  outline: "none",
  resize: "vertical",
  lineHeight: 1.5,
};

const rangeStyle: React.CSSProperties = {
  width: "100%",
  cursor: "pointer",
  outline: "none",
  accentColor: "var(--accent)",
};

function chipPicker(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 12px",
    borderRadius: "var(--radius-md)",
    fontSize: 12,
    background: active
      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
      : "rgba(255,255,255,0.02)",
    border: active
      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
      : "1px solid var(--line-2)",
    color: active ? "var(--accent)" : "var(--fg-1)",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "background 160ms, border-color 160ms",
  };
}

function pillPicker(active: boolean): React.CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: "var(--radius-pill)",
    fontSize: 11.5,
    background: active
      ? "color-mix(in srgb, var(--accent) 14%, transparent)"
      : "transparent",
    border: active
      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
      : "1px solid var(--line-2)",
    color: active ? "var(--accent)" : "var(--fg-1)",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "background 160ms, border-color 160ms",
  };
}
