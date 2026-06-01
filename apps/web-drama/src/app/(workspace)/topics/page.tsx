"use client";

export const dynamic = "force-dynamic";

// 智能选题（v0.7.1，原「模板广场」）：AI 题材推荐（热门题材 + 爆款选题）+ 自定义题材 / 人设 / 故事框架。
// 选中后带入「短剧创作 · 极速模式」一键生成。
import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Lightbulb, TrendingUp, Wand2 } from "lucide-react";
import { Button, Card, Chip } from "@/components/premium";
import { Field, Select, TextArea, ViewHeader, SectionHeader, ComingSoon } from "@/components/common";
import { GENRES } from "../create/_flow/useDramaDraft";
import { DRAMA_TEMPLATES } from "@/lib/drama-templates";

// 热门题材（编辑精选；实时全网热度榜即将上线）。heat: 1-3 火苗。
const HOT_GENRES: { name: string; genre: string; blurb: string; heat: number }[] = [
  { name: "甜宠", genre: "甜宠", blurb: "强反差人设、心动名场面", heat: 3 },
  { name: "逆袭爽剧", genre: "逆袭爽剧", blurb: "打脸反转、爽点密集", heat: 3 },
  { name: "悬疑", genre: "悬疑", blurb: "钩子开场、层层反转", heat: 2 },
  { name: "古装", genre: "古装", blurb: "宫斗 / 权谋 / 一夜翻身", heat: 2 },
  { name: "带货", genre: "都市情感", blurb: "剧情种草、自然植入商品", heat: 3 },
  { name: "乡村", genre: "都市情感", blurb: "返乡创业、温情治愈", heat: 1 },
];

export default function TopicsPage() {
  const router = useRouter();
  const [genre, setGenre] = React.useState(GENRES[0]);
  const [persona, setPersona] = React.useState("");
  const [framework, setFramework] = React.useState("");

  function goExpress(params: Record<string, string>) {
    const q = new URLSearchParams({ mode: "express", ...params });
    router.push(`/create?${q.toString()}`);
  }

  function customGo() {
    const parts: string[] = [];
    if (framework.trim()) parts.push(framework.trim());
    if (persona.trim()) parts.push(`人设：${persona.trim()}`);
    const theme = parts.join("。");
    goExpress({ genre, ...(theme ? { theme } : {}) });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="智能选题"
        title={
          <>
            智能{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              选题
            </span>
          </>
        }
        meta="AI 题材推荐 + 爆款选题框架；选中即带入极速模式一键生成。"
      />

      {/* 热门题材推荐 */}
      <Card style={{ padding: "20px 24px" }}>
        <SectionHeader
          eyebrow="热门题材 · 编辑精选"
          title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><TrendingUp size={15} /> 题材推荐</span>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {HOT_GENRES.map((g) => (
            <button
              key={g.name}
              onClick={() => goExpress({ genre: g.genre })}
              style={{
                textAlign: "left",
                padding: "14px 16px",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-1)",
                border: "1px solid var(--line)",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--fg-0)", fontFamily: "var(--font-display)" }}>{g.name}</span>
                <span style={{ display: "inline-flex", color: "var(--accent)" }}>
                  {Array.from({ length: g.heat }).map((_, i) => <Flame key={i} size={12} />)}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5 }}>{g.blurb}</div>
            </button>
          ))}
        </div>
      </Card>

      {/* 爆款选题（框架完整，可直接生成） */}
      <Card style={{ padding: "20px 24px" }}>
        <SectionHeader
          eyebrow="爆款选题"
          title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Flame size={15} /> 框架完整 · 一键生成</span>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
          {DRAMA_TEMPLATES.map((t) => (
            <Card key={t.id} style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Chip tone="accent">{t.track}</Chip>
                <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)" }}>{t.genre} · {t.durationSec}s</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--fg-0)" }}>{t.title}</div>
              <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.55, flex: 1 }}>{t.blurb}</div>
              <Button variant="primary" size="sm" onClick={() => goExpress({ tpl: t.id })}>
                用此选题生成 <ArrowRight size={13} />
              </Button>
            </Card>
          ))}
        </div>
      </Card>

      {/* 自定义选题 */}
      <Card style={{ padding: "20px 24px" }}>
        <SectionHeader
          eyebrow="自定义"
          title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Lightbulb size={15} /> 自定义题材 / 人设 / 故事框架</span>}
        />
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 12, alignItems: "start" }}>
          <Field label="题材">
            <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </Field>
          <Field label="人设（可选）" hint="主角身份 / 性格 / 关系，如：失忆总裁 × 倔强前妻">
            <TextArea rows={2} value={persona} onChange={(e) => setPersona(e.target.value)} maxLength={200} placeholder="主要角色的身份、性格、关系" />
          </Field>
        </div>
        <Field label="故事框架 / 一句话梗概" hint="核心冲突 + 走向，越具体生成越贴合">
          <TextArea rows={3} value={framework} onChange={(e) => setFramework(e.target.value)} maxLength={400} placeholder="如：雨夜送餐的外卖小哥其实是隐藏总裁，救下落难前女友后旧情复燃。" />
        </Field>
        <Button variant="primary" size="lg" onClick={customGo}>
          <Wand2 size={14} /> 带入极速模式生成
        </Button>
      </Card>

      <ComingSoon
        icon={<TrendingUp size={22} />}
        title="实时热度榜"
        eta="后续版本"
        description="结合全网短剧热度与平台爆款数据的实时题材排行、爆款元素分析即将上线；当前为编辑精选推荐。"
      />
    </div>
  );
}
