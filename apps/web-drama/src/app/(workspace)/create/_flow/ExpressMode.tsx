"use client";

// 极速模式：一句话 / 选模板 → 全自动起草+生成 → 成片。降低小白门槛。
import * as React from "react";
import { ChevronLeft, Coins, Send, SlidersHorizontal, Sparkles, Wand2, Zap } from "lucide-react";
import { Button, Card } from "@/components/premium";
import { ConfirmDialog, Field, Select, TextArea, SectionHeader } from "@/components/common";
import { VideoLibrary } from "@/components/short-drama/video-library";
import { GENRES, DURATIONS, CREDIT_PER_VIDEO, type DramaDraftController } from "./useDramaDraft";

export function ExpressMode({ ctrl, onBack, onSwitchToPro }: { ctrl: DramaDraftController; onBack: () => void; onSwitchToPro: () => void }) {
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const running = ctrl.drafting || ctrl.generating;
  const hasResult = ctrl.jobs.length > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: hasResult ? "minmax(320px, 420px) 1fr" : "1fr", gap: 16, alignItems: "start", maxWidth: hasResult ? undefined : 720, margin: hasResult ? undefined : "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Button variant="ghost" size="sm" onClick={onBack} style={{ alignSelf: "flex-start" }}>
          <ChevronLeft size={14} /> 模式选择
        </Button>

        <Card style={{ padding: "22px 24px" }}>
          <SectionHeader eyebrow="极速模式" title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Zap size={16} style={{ color: "var(--accent)" }} /> 一句话出片</span>} />
          <Field label="短剧主题 / 灵感" hint="输入一句话剧情，平台自动走完 剧本 → 分镜 → 生成。也可从「模板广场」带入。">
            <TextArea rows={4} value={ctrl.theme} onChange={(e) => ctrl.setTheme(e.target.value)} maxLength={300} placeholder="如：失忆总裁在咖啡馆偶遇前妻，一杯拿铁勾起尘封回忆。" />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="题材">
              <Select value={ctrl.genre} onChange={(e) => ctrl.setGenre(e.target.value)}>
                {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            </Field>
            <Field label="时长">
              <Select value={String(ctrl.duration)} onChange={(e) => ctrl.setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => <option key={d} value={d}>{d} 秒</option>)}
              </Select>
            </Field>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-2)", margin: "2px 0 12px" }}>
            <Coins size={14} style={{ color: "var(--accent)" }} /> 预计消耗 <b style={{ color: "var(--fg-0)" }}>{CREDIT_PER_VIDEO}</b> 积分 · 生成 1 条成片
          </div>
          <Button variant="primary" size="lg" loading={running} disabled={running} onClick={() => setConfirmOpen(true)} style={{ width: "100%" }}>
            <Wand2 size={15} /> {running ? "正在生成…" : "一键生成短剧"}
          </Button>
          {ctrl.draftError && <div style={errorBoxStyle}>{ctrl.draftError}</div>}
          <Button variant="ghost" size="md" onClick={onSwitchToPro} style={{ width: "100%", marginTop: 8 }}>
            <SlidersHorizontal size={13} /> 切换到专业模式逐环精修
          </Button>
        </Card>
      </div>

      {hasResult && (
        <Card style={{ padding: "20px 24px" }}>
          <SectionHeader
            eyebrow="成片"
            title="短剧视频"
            right={
              <div style={{ display: "flex", gap: 8 }}>
                <Button variant="secondary" size="sm" loading={ctrl.publishing} onClick={ctrl.handlePublishToProject} disabled={ctrl.publishing}>
                  <Send size={12} /> 归入项目
                </Button>
                <Button variant="primary" size="sm" onClick={ctrl.handleGoDistribute}>去分发 →</Button>
              </div>
            }
          />
          <VideoLibrary jobs={ctrl.jobs} />
          <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={12} /> 想换镜头 / 加变体？点上方「切换到专业模式」继续精修。
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="一键生成短剧"
        description={`将自动起草脚本并生成 1 条成片，预计消耗 ${CREDIT_PER_VIDEO} 积分。`}
        confirmLabel="开始生成"
        onConfirm={async () => {
          await ctrl.expressRun();
        }}
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
