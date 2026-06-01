"use client";

// 专业模式：分步流水线（灵感 → 剧本 → 分镜 → 角色 → 生成 → 成片 → 审核占位）。
import * as React from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  FileText,
  Film,
  Layers,
  Lightbulb,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button, Card } from "@/components/premium";
import { SectionHeader, StatusBadge, TextInput } from "@/components/common";
import { Stepper, type StepDef } from "./Stepper";
import type { CreateStep, DramaDraftController } from "./useDramaDraft";
import { StepInspiration } from "./steps/StepInspiration";
import { StepScript } from "./steps/StepScript";
import { StepCast } from "./steps/StepCast";
import { StepGenerate } from "./steps/StepGenerate";
import { StepFootage } from "./steps/StepFootage";
import { StepReview } from "./steps/StepReview";

const STEPS: StepDef[] = [
  { key: "inspiration", label: "选题", icon: <Lightbulb size={13} /> },
  { key: "cast", label: "角色", icon: <Users size={13} /> },
  { key: "script", label: "脚本", icon: <FileText size={13} /> },
  { key: "generate", label: "生成", icon: <Sparkles size={13} /> },
  { key: "footage", label: "成片", icon: <Film size={13} /> },
  { key: "review", label: "审核", icon: <ShieldCheck size={13} />, disabled: true },
];
const ENABLED = STEPS.filter((s) => !s.disabled).map((s) => s.key);

export function ProMode({ ctrl, onBack }: { ctrl: DramaDraftController; onBack: () => void }) {
  const [step, setStep] = React.useState<CreateStep>("inspiration");
  const s = ctrl.activeScript;

  const enabledIdx = ENABLED.indexOf(step);
  const isFirst = enabledIdx <= 0;
  const isLast = enabledIdx === ENABLED.length - 1;
  const nextBlocked = step === "inspiration" && !s;

  function goPrev() {
    if (enabledIdx > 0) setStep(ENABLED[enabledIdx - 1]);
  }
  function goNext() {
    if (enabledIdx < ENABLED.length - 1) setStep(ENABLED[enabledIdx + 1]);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, alignItems: "start" }}>
      {/* 左栏：模式返回 + 已保存脚本 + 剧集 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ alignSelf: "flex-start" }}>
          <ChevronLeft size={14} /> 模式选择
        </Button>

        {ctrl.savedScripts.length > 0 && (
          <Card style={{ padding: "18px 20px" }}>
            <SectionHeader eyebrow="我的脚本" title="已保存脚本" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
              {ctrl.savedScripts.map((sc) => (
                <ScriptRow key={sc.id} title={sc.title} genre={sc.genre} duration={sc.duration_sec} scenes={sc.scenes?.length ?? 0} active={s?.id === sc.id} onClick={() => ctrl.loadSaved(sc)} />
              ))}
            </div>
          </Card>
        )}

        {s && (
          <Card style={{ padding: "18px 20px" }}>
            <SectionHeader eyebrow="剧集" title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Layers size={14} /> 多集管理</span>} />
            {!s.series_id ? (
              <Button variant="secondary" size="md" onClick={ctrl.makeSeries}>设为剧集（第 1 集）</Button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ctrl.seriesEpisodes.map((ep) => (
                  <ScriptRow key={ep.id} title={`第${ep.episode_no ?? "?"}集 · ${ep.title}`} genre={ep.genre} duration={ep.duration_sec} scenes={ep.scenes?.length ?? 0} active={s.id === ep.id} onClick={() => ctrl.loadSaved(ep)} />
                ))}
                <Button variant="ghost" size="md" onClick={ctrl.addEpisode}><Plus size={13} /> 新增下一集</Button>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* 右栏：头部 + stepper + 步骤 + 导航 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Card style={{ padding: "20px 24px" }}>
          {s ? (
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <TextInput
                  value={s.title}
                  onChange={(e) => ctrl.update({ title: e.target.value })}
                  style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)", background: "transparent", border: "none", padding: 0 }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <StatusBadge tone="accent" dot={false}>{s.genre}</StatusBadge>
                  <StatusBadge tone="neutral" dot={false}>{s.duration_sec}s</StatusBadge>
                  <StatusBadge tone="neutral" dot={false}>{s.scenes?.length ?? 0} 镜</StatusBadge>
                  {s.series_id && <StatusBadge tone="info" dot={false}>第 {s.episode_no ?? 1} 集</StatusBadge>}
                  {s.drama_id && <StatusBadge tone="success" dot={false}>已归入项目</StatusBadge>}
                </div>
              </div>
              <Button variant="secondary" size="sm" loading={ctrl.saving} onClick={ctrl.handleSave} disabled={ctrl.saving}><Save size={12} /> 保存脚本</Button>
            </div>
          ) : (
            <div style={{ marginBottom: 16, fontSize: 13, color: "var(--fg-2)" }}>新短剧 · 在「灵感」步用一句话起草，或手动新建空白脚本。</div>
          )}
          <Stepper steps={STEPS} current={step} onSelect={setStep} />
        </Card>

        {step === "inspiration" && <StepInspiration ctrl={ctrl} />}
        {step === "cast" && <StepCast ctrl={ctrl} />}
        {step === "script" && <StepScript ctrl={ctrl} />}
        {step === "generate" && <StepGenerate ctrl={ctrl} onGenerated={() => setStep("footage")} />}
        {step === "footage" && <StepFootage ctrl={ctrl} />}
        {step === "review" && <StepReview />}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Button variant="ghost" size="md" onClick={goPrev} disabled={isFirst}><ArrowLeft size={14} /> 上一步</Button>
          {!isLast && (
            <Button variant="primary" size="md" onClick={goNext} disabled={nextBlocked}>下一步 <ArrowRight size={14} /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScriptRow({ title, genre, duration, scenes, active, onClick }: { title: string; genre: string; duration: number; scenes: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-1)",
        border: active ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--line)",
        cursor: "pointer",
        fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>{title}</div>
      <div style={{ fontSize: 10.5, color: "var(--fg-3)", marginTop: 2 }}>{genre} · {duration}s · {scenes} 镜</div>
    </button>
  );
}
