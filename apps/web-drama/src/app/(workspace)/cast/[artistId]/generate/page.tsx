"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Sparkles, Wand2 } from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import { Button, Card } from "@/components/premium";
import {
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  SectionHeader,
  Select,
  StatusBadge,
  TextArea,
  ViewHeader,
} from "@/components/common";
import { useAsync } from "@/lib/drama-query";
import { ArtistsApi } from "@/api";

interface PageProps {
  params: Promise<{ artistId: string }>;
}

type Style = "cinematic" | "anime" | "ink" | "modern" | "vintage";
type Ratio = "9:16" | "16:9" | "1:1" | "4:5";

const STYLES: Array<{ value: Style; label: string }> = [
  { value: "cinematic", label: "电影感（推荐）" },
  { value: "anime", label: "二次元" },
  { value: "ink", label: "水墨风" },
  { value: "modern", label: "现代时尚" },
  { value: "vintage", label: "复古胶片" },
];

const RATIOS: Array<{ value: Ratio; label: string }> = [
  { value: "9:16", label: "9:16 · 竖屏短剧" },
  { value: "16:9", label: "16:9 · 横屏" },
  { value: "1:1", label: "1:1 · 头像 / 海报" },
  { value: "4:5", label: "4:5 · 信息流" },
];

export default function ArtistGeneratePage({ params }: PageProps) {
  const { artistId } = React.use(params);
  const router = useRouter();
  const q = useAsync<Artist | null>(`/me/artists/${artistId}`, () => ArtistsApi.getArtist(artistId));

  const [style, setStyle] = React.useState<Style>("cinematic");
  const [ratio, setRatio] = React.useState<Ratio>("9:16");
  const [prompt, setPrompt] = React.useState("雨夜便利店外，霓虹反射在水洼里，演员撑伞回望。");
  const [running, setRunning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [results, setResults] = React.useState<string[]>([]);

  if (q.isLoading) return <LoadingBlock rows={3} height={120} />;
  if (q.error) return <ErrorBlock onRetry={q.refetch} />;
  if (!q.data) {
    return (
      <EmptyState
        icon={<Sparkles size={28} />}
        title="演员不存在"
        action={
          <Button variant="primary" size="md" onClick={() => router.push("/cast")}>
            返回阵容
          </Button>
        }
      />
    );
  }
  const a = q.data;

  async function start() {
    if (!prompt.trim()) {
      toast.error("请先填写场景提示词");
      return;
    }
    setRunning(true);
    setProgress(0);
    setResults([]);
    // Mock：4 步进度条
    for (let i = 1; i <= 4; i++) {
      await new Promise((r) => setTimeout(r, 450));
      setProgress(i * 25);
    }
    // 假返回 4 张候选（用 gradient 当占位）
    const palette = [
      "linear-gradient(135deg, rgba(212,175,106,0.6), rgba(164,76,255,0.4))",
      "linear-gradient(135deg, rgba(61,224,255,0.5), rgba(76,224,160,0.4))",
      "linear-gradient(135deg, rgba(164,76,255,0.55), rgba(255,61,138,0.35))",
      "linear-gradient(135deg, rgba(76,224,160,0.5), rgba(212,175,106,0.45))",
    ];
    setResults(palette);
    setRunning(false);
    toast.success("已生成 4 张候选", { description: "点选满意的一张可应用到演员档案" });
  }

  async function applyAppearance(idx: number) {
    toast.success(`已把候选 #${idx + 1} 设为 ${a.name} 的当前形象`);
    // 真实接入时：await ArtistsApi.patchArtist(a.id, { officialAppearanceId: ... })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <button
        onClick={() => router.push(`/cast/${encodeURIComponent(a.id)}`)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          fontSize: 12,
          color: "var(--fg-2)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        <ArrowLeft size={12} /> 返回 {a.name} 档案
      </button>

      <ViewHeader
        eyebrow={`forge · ${a.name}`}
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
        meta="参数 → 提示词 → 4 张候选 → 应用到档案"
      />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        <Card style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 4 }}>
          <SectionHeader eyebrow="parameters" title="生成参数" />

          <Field label="风格">
            <Select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
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
          <Field label="场景提示词" hint="加细节更稳：天气、光源、镜头、情绪。" required>
            <TextArea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={400}
            />
          </Field>

          <Button
            variant="primary"
            size="lg"
            loading={running}
            onClick={start}
            style={{ marginTop: 6 }}
          >
            <Wand2 size={14} />
            {running ? "生成中…" : "开始生成（消耗 200 积分）"}
          </Button>

          {running && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  height: 6,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "var(--radius-pill)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    background: "var(--gradient-gold)",
                    transition: "width 250ms ease",
                  }}
                />
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 10.5,
                  color: "var(--fg-3)",
                  letterSpacing: 0.4,
                  marginTop: 6,
                  textAlign: "right",
                }}
              >
                {progress}% · 渲染中
              </div>
            </div>
          )}
        </Card>

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
              description="填好参数，点击「开始生成」即可一次性出 4 张候选。"
            />
          )}
          {running && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 14,
              }}
            >
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
                  <div className="mono" style={{ position: "absolute", top: 10, left: 12, fontSize: 10, color: "#f8f3e8", letterSpacing: 0.6 }}>
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
                    <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => applyAppearance(i)}>
                      应用
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
      </div>
    </div>
  );
}
