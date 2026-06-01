"use client";

// 极速模式：一句话 / 选题 → 一次性生成完整脚本包（人物 / 分镜 / 场景，可多集）→ 逐集一键生成视频。
// 与专业模式的唯一区别：脚本是「自动整包生成」而非「分步搭建」；产物结构完全一致。
import * as React from "react";
import { ChevronLeft, Clapperboard, Coins, RefreshCw, Send, SlidersHorizontal, Sparkles, Users, Wand2, Zap } from "lucide-react";
import { Button, Card, Chip } from "@/components/premium";
import { ConfirmDialog, Field, Select, TextArea, SectionHeader, StatusBadge } from "@/components/common";
import { VideoLibrary } from "@/components/short-drama/video-library";
import { GENRES, DURATIONS, EPISODE_COUNTS, CREDIT_PER_VIDEO, type DramaDraftController } from "./useDramaDraft";
import type { DramaScript } from "@/api/short-drama";

type Phase = "form" | "package";

export function ExpressMode({ ctrl, onBack, onSwitchToPro }: { ctrl: DramaDraftController; onBack: () => void; onSwitchToPro: () => void }) {
  const [phase, setPhase] = React.useState<Phase>("form");
  const [episodeCount, setEpisodeCount] = React.useState(1);
  const [episodes, setEpisodes] = React.useState<DramaScript[]>([]);
  const [busyEp, setBusyEp] = React.useState<Record<string, boolean>>({});
  const [busyAll, setBusyAll] = React.useState(false);
  const [confirmAllOpen, setConfirmAllOpen] = React.useState(false);

  async function runGenerate() {
    const eps = await ctrl.expressGenerate(episodeCount);
    if (eps && eps.length > 0) {
      setEpisodes(eps);
      setPhase("package");
    }
  }

  async function genEpisode(ep: DramaScript) {
    setBusyEp((b) => ({ ...b, [ep.id]: true }));
    await ctrl.generateForEpisode(ep.id, ep.title);
    setBusyEp((b) => ({ ...b, [ep.id]: false }));
  }

  async function genAll() {
    setBusyAll(true);
    for (const ep of episodes) {
      await ctrl.generateForEpisode(ep.id, ep.title);
    }
    setBusyAll(false);
  }

  // ── 表单态 ───────────────────────────────────────────────────────────────
  if (phase === "form") {
    return (
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ marginBottom: 12 }}>
          <ChevronLeft size={14} /> 模式选择
        </Button>
        <Card style={{ padding: "24px 26px" }}>
          <SectionHeader eyebrow="极速模式" title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Zap size={16} style={{ color: "var(--accent)" }} /> 一句话生成完整短剧</span>} />
          <div style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.6, marginBottom: 14 }}>
            自动生成人物、故事、分镜与场景（多集时为一个剧集）。生成后逐集一键出片。
          </div>
          <Field label="短剧主题 / 灵感" hint="也可从「智能选题」挑题材 / 人设 / 故事框架带入。">
            <TextArea rows={4} value={ctrl.theme} onChange={(e) => ctrl.setTheme(e.target.value)} maxLength={400} placeholder="如：失忆总裁在咖啡馆偶遇前妻，一杯拿铁勾起尘封回忆。" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Field label="题材">
              <Select value={ctrl.genre} onChange={(e) => ctrl.setGenre(e.target.value)}>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            </Field>
            <Field label="单集时长">
              <Select value={String(ctrl.duration)} onChange={(e) => ctrl.setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d} 秒</option>)}
              </Select>
            </Field>
            <Field label="集数">
              <Select value={String(episodeCount)} onChange={(e) => setEpisodeCount(Number(e.target.value))}>
                {EPISODE_COUNTS.map((n) => <option key={n} value={n}>{n} 集</option>)}
              </Select>
            </Field>
          </div>
          <Button variant="primary" size="lg" loading={ctrl.drafting} disabled={ctrl.drafting} onClick={runGenerate} style={{ width: "100%", marginTop: 4 }}>
            <Wand2 size={15} /> {ctrl.drafting ? "正在生成完整脚本…" : "一键生成短剧脚本"}
          </Button>
          {ctrl.draftError && <div style={errorBoxStyle}>{ctrl.draftError}</div>}
          <Button variant="ghost" size="md" onClick={onSwitchToPro} style={{ width: "100%", marginTop: 8 }}>
            <SlidersHorizontal size={13} /> 改用专业模式逐环搭建
          </Button>
        </Card>
      </div>
    );
  }

  // ── 整包结果态 ───────────────────────────────────────────────────────────
  const chars = episodes[0]?.characters ?? [];
  const totalCredits = episodes.length * CREDIT_PER_VIDEO;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Button variant="ghost" size="sm" onClick={() => setPhase("form")}><RefreshCw size={13} /> 重新生成</Button>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="md" onClick={onSwitchToPro}><SlidersHorizontal size={13} /> 切换到专业模式微调</Button>
        <Button variant="primary" size="md" loading={busyAll} disabled={busyAll} onClick={() => setConfirmAllOpen(true)}>
          <Sparkles size={14} /> 一键生成全部视频（{episodes.length} 集）
        </Button>
      </div>

      {/* 人物（整包共用） */}
      {chars.length > 0 && (
        <Card style={{ padding: "18px 22px" }}>
          <SectionHeader eyebrow="人物" title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Users size={14} /> 角色阵容</span>} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {chars.map((c) => (
              <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: "var(--radius-pill)", background: "var(--surface-1)", border: "1px solid var(--line)", fontSize: 12.5, color: "var(--fg-1)" }}>
                <b style={{ color: "var(--fg-0)" }}>{c.name || "未命名"}</b>
                {c.cast_name ? <Chip tone="success">{c.cast_name}</Chip> : null}
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* 剧集总览：逐集卡片 + 本集生成 + 本集成片 */}
      {episodes.map((ep, i) => {
        const epJobs = ctrl.jobsFor(ep.id);
        return (
          <Card key={ep.id} style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Clapperboard size={15} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--fg-0)" }}>
                  {episodes.length > 1 ? `第 ${ep.episode_no ?? i + 1} 集 · ` : ""}{ep.title}
                </span>
                <StatusBadge tone="neutral" dot={false}>{ep.scenes?.length ?? 0} 镜</StatusBadge>
                <StatusBadge tone="neutral" dot={false}>{ep.duration_sec}s</StatusBadge>
              </div>
              <Button variant="secondary" size="sm" loading={!!busyEp[ep.id]} disabled={!!busyEp[ep.id] || busyAll} onClick={() => genEpisode(ep)}>
                <Sparkles size={12} /> 生成本集视频
              </Button>
            </div>
            {epJobs.length > 0 ? (
              <VideoLibrary jobs={epJobs} />
            ) : (
              <div style={{ fontSize: 12, color: "var(--fg-3)" }}>脚本已就绪（{ep.scenes?.length ?? 0} 个分镜场景）。点「生成本集视频」单独派发该集生成任务。</div>
            )}
          </Card>
        );
      })}

      {/* 整包级动作 */}
      <Card style={{ padding: "16px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-2)" }}>
          <Coins size={14} style={{ color: "var(--accent)" }} /> 一键生成全部预计消耗 <b style={{ color: "var(--fg-0)" }}>{totalCredits}</b> 积分 · 逐集独立任务
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" loading={ctrl.publishing} onClick={ctrl.handlePublishToProject} disabled={ctrl.publishing}>
            <Send size={12} /> 归入项目
          </Button>
          <Button variant="primary" size="sm" onClick={ctrl.handleGoDistribute}>去分发 →</Button>
        </div>
      </Card>

      <ConfirmDialog
        open={confirmAllOpen}
        onOpenChange={setConfirmAllOpen}
        title="一键生成全部视频"
        description={`将为 ${episodes.length} 集分别派发生成任务，预计共消耗 ${totalCredits} 积分。`}
        confirmLabel="开始生成"
        onConfirm={genAll}
      />
    </div>
  );
}

const errorBoxStyle: React.CSSProperties = {
  marginTop: 12,
  fontSize: 12,
  color: "var(--danger)",
  background: "color-mix(in srgb, var(--danger) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
  borderRadius: "var(--radius-sm)",
  padding: "8px 10px",
  lineHeight: 1.6,
};
