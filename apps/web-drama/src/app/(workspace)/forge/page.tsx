"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Sparkles, Star, Users, Wand2 } from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import { Button, Card, KpiCard } from "@/components/premium";
import {
  EmptyState,
  Field,
  LoadingBlock,
  SectionHeader,
  Select,
  StatusBadge,
  TextArea,
  ViewHeader,
} from "@/components/common";
import { ArtistsApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";

type Style = "cinematic" | "anime" | "ink" | "modern" | "vintage";
type Ratio = "9:16" | "16:9" | "1:1" | "4:5";

const STYLES: Array<{ value: Style; label: string; cost: number }> = [
  { value: "cinematic", label: "电影感（推荐）", cost: 200 },
  { value: "anime", label: "二次元", cost: 160 },
  { value: "ink", label: "水墨风", cost: 220 },
  { value: "modern", label: "现代时尚", cost: 180 },
  { value: "vintage", label: "复古胶片", cost: 220 },
];

const RATIOS: Array<{ value: Ratio; label: string }> = [
  { value: "9:16", label: "9:16 · 竖屏短剧" },
  { value: "16:9", label: "16:9 · 横屏" },
  { value: "1:1", label: "1:1 · 头像 / 海报" },
  { value: "4:5", label: "4:5 · 信息流" },
];

const PRESET_STORAGE_KEY = "drama:forge:presets";

interface ForgePreset {
  id: string;
  name: string;
  style: Style;
  ratio: Ratio;
  prompt: string;
  createdAt: string;
}

function loadPresets(): ForgePreset[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(PRESET_STORAGE_KEY) ?? "[]") as ForgePreset[];
  } catch {
    return [];
  }
}

function savePresets(p: ForgePreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(p));
}

export default function ForgePage() {
  const router = useRouter();
  const [style, setStyle] = React.useState<Style>("cinematic");
  const [ratio, setRatio] = React.useState<Ratio>("9:16");
  const [prompt, setPrompt] = React.useState("");
  const [selectedArtists, setSelectedArtists] = React.useState<Set<string>>(new Set());
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [results, setResults] = React.useState<string[]>([]);
  const [presets, setPresets] = React.useState<ForgePreset[]>([]);

  React.useEffect(() => setPresets(loadPresets()), []);

  const artistsQ = useAsync<Artist[]>("/me/artists", () => ArtistsApi.listArtists());
  const allArtists = artistsQ.data ?? [];
  const cost = STYLES.find((s) => s.value === style)?.cost ?? 200;

  async function start() {
    if (!prompt.trim()) {
      toast.error("请填写场景提示词");
      return;
    }
    setRunning(true);
    setProgress(0);
    setResults([]);
    for (let i = 1; i <= 5; i++) {
      await new Promise((r) => setTimeout(r, 380));
      setProgress(i * 20);
    }
    setResults([
      "linear-gradient(135deg, rgba(212,175,106,0.6), rgba(164,76,255,0.4))",
      "linear-gradient(135deg, rgba(61,224,255,0.5), rgba(76,224,160,0.4))",
      "linear-gradient(135deg, rgba(164,76,255,0.55), rgba(255,61,138,0.35))",
      "linear-gradient(135deg, rgba(76,224,160,0.5), rgba(212,175,106,0.45))",
    ]);
    setRunning(false);
    toast.success(`已生成 4 张候选 · 扣除 ${cost} 积分`);
  }

  function savePreset() {
    if (!prompt.trim()) {
      toast.error("先填写提示词再保存");
      return;
    }
    const name = window.prompt("给这个预设起个名字", `预设 #${presets.length + 1}`);
    if (!name) return;
    const next: ForgePreset = {
      id: `prs-${Date.now()}`,
      name,
      style,
      ratio,
      prompt,
      createdAt: new Date().toISOString(),
    };
    const all = [next, ...presets];
    setPresets(all);
    savePresets(all);
    toast.success("已保存到本地预设");
  }

  function applyPreset(p: ForgePreset) {
    setStyle(p.style);
    setRatio(p.ratio);
    setPrompt(p.prompt);
    toast.info(`已载入预设「${p.name}」`);
  }

  function deletePreset(id: string) {
    const all = presets.filter((p) => p.id !== id);
    setPresets(all);
    savePresets(all);
  }

  async function applyTo(resultIdx: number) {
    if (selectedArtists.size === 0) {
      toast.error("请先在右侧勾选要应用的演员");
      return;
    }
    const ids = Array.from(selectedArtists);
    let okCount = 0;
    for (const id of ids) {
      try {
        const a = allArtists.find((x) => x.id === id);
        if (!a) continue;
        await ArtistsApi.patchArtist(id, {
          // 仅 mock 演示：把简介尾部加一段标记
          bio: `${a.bio}\n（已应用 forge 候选 #${resultIdx + 1}，${new Date().toLocaleString("zh-CN")}）`,
        });
        okCount++;
      } catch (e) {
        // skip
      }
    }
    invalidate("/me/artists");
    toast.success(`已应用到 ${okCount} 个演员`);
    setSelectedArtists(new Set());
  }

  function toggleArtist(id: string) {
    setSelectedArtists((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="forge"
        title={
          <>
            形象{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              锻造炉
            </span>
          </>
        }
        meta="参数 → 生成 → 选择 → 应用到演员档案"
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="本月已生成" value="124" tone="accent" delta="+18 本周" />
        <KpiCard label="本月候选" value="496" tone="info" delta="平均 4 张 / 次" />
        <KpiCard label="应用到档案" value="42" tone="success" delta="34% 转化" />
        <KpiCard label="本地预设" value={String(presets.length)} tone="violet" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr 280px", gap: 16 }}>
        {/* 参数 */}
        <Card style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 4 }}>
          <SectionHeader eyebrow="parameters" title="生成参数" />
          <Field label="风格">
            <Select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label} · {s.cost} 积分
                </option>
              ))}
            </Select>
          </Field>
          <Field label="比例">
            <Select value={ratio} onChange={(e) => setRatio(e.target.value as Ratio)}>
              {RATIOS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="场景提示词" hint="加细节更稳。" required>
            <TextArea
              rows={6}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={400}
              placeholder="如：雨夜便利店外，霓虹反射在水洼里，演员撑伞回望。"
            />
          </Field>

          <Button variant="primary" size="lg" loading={running} onClick={start}>
            <Wand2 size={14} />
            {running ? `生成中… ${progress}%` : `生成（${cost} 积分）`}
          </Button>
          <Button variant="ghost" size="sm" onClick={savePreset} style={{ marginTop: 6 }}>
            <Star size={11} />
            保存为预设
          </Button>

          {presets.length > 0 && (
            <>
              <div className="eyebrow" style={{ marginTop: 18 }}>
                presets
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                {presets.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 10px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid var(--line)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <button
                      onClick={() => applyPreset(p)}
                      style={{
                        flex: 1,
                        background: "transparent",
                        border: "none",
                        color: "var(--fg-1)",
                        fontSize: 12,
                        textAlign: "left",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      {p.name}
                    </button>
                    <button
                      onClick={() => deletePreset(p.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--fg-3)",
                        cursor: "pointer",
                        fontSize: 11,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* 中间结果 */}
        <Card style={{ padding: "22px 24px", minHeight: 480 }}>
          <SectionHeader
            eyebrow="results"
            title="候选预览"
            right={results.length > 0 ? <StatusBadge tone="success">{results.length} 张</StatusBadge> : null}
          />
          {results.length === 0 && !running && (
            <EmptyState
              icon={<Sparkles size={28} />}
              title="还没有候选"
              description="填好参数 → 生成 → 选择 → 右侧勾选演员后点击「应用」即可批量绑定。"
            />
          )}
          {running && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="drama-skeleton"
                  style={{ height: 220, borderRadius: "var(--radius-md)" }}
                />
              ))}
            </div>
          )}
          {results.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
              {results.map((g, i) => (
                <div
                  key={i}
                  style={{
                    height: 240,
                    borderRadius: "var(--radius-md)",
                    background: g,
                    border: "1px solid var(--line-2)",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.55))",
                    }}
                  />
                  <div
                    className="mono"
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 12,
                      fontSize: 10,
                      color: "#f8f3e8",
                      letterSpacing: 0.6,
                    }}
                  >
                    #{String(i + 1).padStart(2, "0")}
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      left: 12,
                      right: 12,
                      bottom: 12,
                      display: "flex",
                      gap: 6,
                    }}
                  >
                    <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => applyTo(i)}>
                      应用到选中
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => toast.info("已加入收藏（即将上线）")}
                    >
                      ★
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 右：演员选择 */}
        <Card style={{ padding: "22px 22px" }}>
          <SectionHeader
            eyebrow="apply to"
            title="演员选择"
            right={<StatusBadge tone="accent">{selectedArtists.size} 选中</StatusBadge>}
          />
          {artistsQ.isLoading && <LoadingBlock rows={3} height={48} />}
          {!artistsQ.isLoading && allArtists.length === 0 && (
            <EmptyState icon={<Users size={24} />} title="还没有演员" />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 380, overflowY: "auto" }}>
            {allArtists.map((a) => {
              const checked = selectedArtists.has(a.id);
              return (
                <label
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    background: checked
                      ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                      : "rgba(255,255,255,0.02)",
                    border: checked
                      ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)"
                      : "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleArtist(a.id)}
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.name}</div>
                    <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)" }}>
                      {a.type} · {a.quality}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
