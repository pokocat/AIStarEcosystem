"use client";

export const dynamic = "force-dynamic";

// 形象锻造炉（v0.43+）：与「AI 音乐人」共用同一套大模型形象顾问逻辑，界面保持短剧影院风。
// 选演员 + 画面风格 + 角色/剧情描述 → 「开始锻造」生成完整形象方案；可继续对话打磨。
import * as React from "react";
import { Bot, Loader2, Send, Sparkles, Wand2 } from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import { Button, Card } from "@/components/premium";
import { Field, Select, TextArea, ViewHeader, SectionHeader, StatusBadge } from "@/components/common";
import { ArtistsApi, AppearanceForgeApi } from "@/api";
import { useAsync } from "@/lib/drama-query";
import { ARTIST_TYPE_LABELS } from "@/constants/artist-config";

type Style = "cinematic" | "anime" | "ink" | "modern" | "vintage";

const STYLES: Array<{ value: Style; label: string }> = [
  { value: "cinematic", label: "电影感" },
  { value: "anime", label: "二次元" },
  { value: "ink", label: "水墨风" },
  { value: "modern", label: "现代时尚" },
  { value: "vintage", label: "复古胶片" },
];

interface Turn {
  id: string;
  role: "user" | "assistant";
  text: string;
}

function buildDramaForgePrompt(opts: { artist: Artist | null; styleLabel: string; scene: string }): string {
  const { artist, styleLabel, scene } = opts;
  return [
    "你正在为一部短剧打磨一个角色/演员的形象。请输出一份可直接执行的中文形象方案。",
    artist
      ? `角色 / 演员：${artist.name}（类型：${ARTIST_TYPE_LABELS[artist.type] ?? artist.type}）`
      : "角色 / 演员：未指定，请基于剧情描述自主建立一个有记忆点的角色形象。",
    artist?.bio ? `已有设定：${artist.bio}` : null,
    `画面风格：${styleLabel}`,
    scene.trim() ? `剧情 / 角色描述：${scene.trim()}` : "剧情 / 角色描述：未填写，请按风格给出通用建议。",
    "请按以下结构输出：",
    "1. 角色定位：一句话点明人设与在剧中的作用。",
    "2. 外形与造型：发型、妆容、服装、材质、配色。",
    "3. 气质与镜头：适合的光线、景别、氛围与表演基调。",
    "4. 与剧情契合：这版形象如何服务于剧情和爽点。",
    "5. 风险与优化：2-3 个要避免的问题。",
    "全程中文，可落地，不要 JSON、不要代码块。",
  ]
    .filter(Boolean)
    .join("\n");
}

export default function ForgePage() {
  const artistsQ = useAsync<Artist[]>("/me/artists", () => ArtistsApi.listArtists());
  const allArtists = artistsQ.data ?? [];

  const [artistId, setArtistId] = React.useState<string>("");
  const [style, setStyle] = React.useState<Style>("cinematic");
  const [scene, setScene] = React.useState("");
  const [conversation, setConversation] = React.useState<Turn[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "在左侧选好演员、风格，写下剧情或角色描述，点「开始锻造」我就生成一版完整形象方案；也可以直接在下面继续和我说，我们一起打磨。",
    },
  ]);
  const [composer, setComposer] = React.useState("");
  const [generating, setGenerating] = React.useState(false);
  const [providerStatus, setProviderStatus] = React.useState<AppearanceForgeApi.ForgeProviderStatus | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    AppearanceForgeApi.getForgeProviderStatus()
      .then((s) => !cancelled && setProviderStatus(s))
      .catch(() => !cancelled && setProviderStatus({ configured: false, provider: "none", message: "形象锻造暂不可用" }));
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (allArtists.length > 0 && !artistId) setArtistId(allArtists[0].id);
  }, [allArtists, artistId]);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation]);

  const selectedArtist = allArtists.find((a) => a.id === artistId) ?? null;
  const styleLabel = STYLES.find((s) => s.value === style)?.label ?? "电影感";

  async function runStream(prompt: string) {
    if (generating) return;
    if (providerStatus && !providerStatus.configured) {
      pushAssistant(providerStatus.message || "形象锻造还没接入大模型，请稍后再试。");
      return;
    }
    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setConversation((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);
    try {
      await AppearanceForgeApi.streamForgeConversation(
        { artistId: artistId || "drama-freeform", prompt },
        {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.event === "delta") {
              setConversation((prev) => prev.map((t) => (t.id === assistantId ? { ...t, text: event.data.reply } : t)));
            } else if (event.event === "message" || event.event === "completed") {
              const content = event.data.content;
              if (content) setConversation((prev) => prev.map((t) => (t.id === assistantId ? { ...t, text: content } : t)));
            }
          },
        },
      );
      setConversation((prev) =>
        prev.map((t) => (t.id === assistantId && !t.text.trim() ? { ...t, text: "这次没有生成有效内容，请换个说法再试一次。" } : t)),
      );
    } catch (e) {
      const message = (e as Error).message || "形象方案生成失败，请稍后重试";
      setConversation((prev) => prev.map((t) => (t.id === assistantId && !t.text.trim() ? { ...t, text: `（${message}）` } : t)));
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  }

  function pushAssistant(text: string) {
    setConversation((prev) => [...prev, { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, role: "assistant", text }]);
  }

  function handleStart() {
    const prompt = buildDramaForgePrompt({ artist: selectedArtist, styleLabel, scene });
    void runStream(prompt);
  }

  function handleSend() {
    const text = composer.trim();
    if (!text || generating) return;
    setConversation((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text }]);
    setComposer("");
    const lastPlan = [...conversation].reverse().find((t) => t.role === "assistant" && t.text.trim().length > 40)?.text;
    const prompt = [
      `你正在和短剧形象顾问对话${selectedArtist ? `（角色：${selectedArtist.name}）` : ""}。`,
      lastPlan ? `当前形象方案如下：\n${lastPlan}` : null,
      `用户的新要求：${text}`,
      "请基于以上给出更新后的形象建议，中文、简明可执行，必要时说明改了哪里。",
    ]
      .filter(Boolean)
      .join("\n\n");
    void runStream(prompt);
  }

  const badgeTone: "success" | "neutral" = providerStatus?.configured ? "success" : "neutral";
  const badgeText = !providerStatus
    ? "检测中"
    : providerStatus.provider === "mock"
      ? "演示模式"
      : providerStatus.configured
        ? "已接入大模型"
        : "未配置";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="形象锻造炉"
        title={
          <>
            形象{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              锻造炉
            </span>
          </>
        }
        meta="选演员 → 描述剧情 → AI 形象顾问对话生成方案"
      />

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
        {/* 左：参数 */}
        <Card style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <SectionHeader eyebrow="设定" title="形象设定" />
            <StatusBadge tone={badgeTone} dot={false}>
              <Bot size={11} style={{ marginRight: 4 }} />
              {badgeText}
            </StatusBadge>
          </div>
          <Field label="演员 / 角色">
            <Select value={artistId} onChange={(e) => setArtistId(e.target.value)}>
              <option value="">未指定（自由创作）</option>
              {allArtists.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {ARTIST_TYPE_LABELS[a.type] ?? a.type}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="画面风格">
            <Select value={style} onChange={(e) => setStyle(e.target.value as Style)}>
              {STYLES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="剧情 / 角色描述" hint="写清角色身份、性格、场景，方案更贴合。">
            <TextArea
              rows={6}
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              maxLength={500}
              placeholder="如：都市悬疑短剧女主，冷静干练的刑警，雨夜追凶，需要既有压迫感又有记忆点。"
            />
          </Field>
          <Button variant="primary" size="lg" loading={generating} onClick={handleStart} disabled={generating}>
            <Wand2 size={14} />
            {generating ? "生成中…" : "开始锻造"}
          </Button>
          {providerStatus && !providerStatus.configured && (
            <p style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 8, lineHeight: 1.6 }}>{providerStatus.message}</p>
          )}
        </Card>

        {/* 右：对话 */}
        <Card style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100dvh - 220px)", minHeight: 460 }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={15} color="var(--accent)" />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>AI 形象顾问</span>
            {selectedArtist && <span style={{ fontSize: 11.5, color: "var(--fg-3)" }}>· 为 {selectedArtist.name} 设计</span>}
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            {conversation.map((turn) => (
              <DramaBubble key={turn.id} turn={turn} />
            ))}
            {generating && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--fg-3)", fontSize: 12 }}>
                <Loader2 size={13} className="animate-spin" /> 形象顾问正在生成…
              </div>
            )}
          </div>

          <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", gap: 8 }}>
            <input
              value={composer}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="继续和形象顾问说点什么…"
              disabled={generating}
              style={{
                flex: 1,
                background: "var(--bg-2)",
                border: "1px solid var(--line-2)",
                borderRadius: "var(--radius-md)",
                padding: "10px 12px",
                fontSize: 13,
                color: "var(--fg-0)",
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            />
            <Button variant="primary" size="md" onClick={handleSend} disabled={!composer.trim() || generating}>
              <Send size={13} />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DramaBubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div
        style={{
          maxWidth: "82%",
          padding: "10px 14px",
          borderRadius: "var(--radius-md)",
          background: isUser ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "var(--surface-1)",
          border: isUser ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--line)",
          fontSize: 13,
          lineHeight: 1.7,
          color: "var(--fg-0)",
          whiteSpace: "pre-wrap",
        }}
      >
        {turn.text || <span style={{ color: "var(--fg-3)" }}>…</span>}
      </div>
    </div>
  );
}
