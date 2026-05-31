"use client";

import * as React from "react";
import { ArrowRight, Plus, Wand2 } from "lucide-react";
import { Button, Card } from "@/components/premium";
import { Field, Select, TextArea, SectionHeader } from "@/components/common";
import { GENRES, DURATIONS, DRAFT_COUNTS, type DramaDraftController } from "../useDramaDraft";

export function StepInspiration({ ctrl }: { ctrl: DramaDraftController }) {
  return (
    <Card style={{ padding: "22px 24px" }}>
      <SectionHeader eyebrow="选题 · 灵感" title="从一句话开始" />
      <Field label="短剧主题 / 灵感" hint="越具体，脚本越贴合。也可以从「模板广场」挑一个赛道带入。">
        <TextArea
          rows={4}
          value={ctrl.theme}
          onChange={(e) => ctrl.setTheme(e.target.value)}
          maxLength={300}
          placeholder="如：外卖小哥其实是隐藏总裁，雨夜送餐救下落难前女友。"
        />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
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
        <Field label="起草版本数">
          <Select value={String(ctrl.draftCount)} onChange={(e) => ctrl.setDraftCount(Number(e.target.value))}>
            {DRAFT_COUNTS.map((n) => <option key={n} value={n}>{n} 稿</option>)}
          </Select>
        </Field>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <Button variant="primary" size="lg" loading={ctrl.drafting} onClick={ctrl.handleDraft} disabled={ctrl.drafting}>
          <Wand2 size={14} /> {ctrl.drafting ? "起草中…" : "AI 起草脚本"}
        </Button>
        <Button variant="ghost" size="lg" onClick={ctrl.newBlankScript}>
          <Plus size={14} /> 手动新建空白脚本
        </Button>
      </div>

      {ctrl.draftError && (
        <div style={errorBoxStyle}>{ctrl.draftError}</div>
      )}

      {ctrl.drafts.length > 1 && (
        <div style={{ marginTop: 16 }}>
          <SectionHeader eyebrow="多稿" title="选择一个草稿" />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ctrl.drafts.map((d) => {
              const active = ctrl.activeScript?.id === d.id;
              return (
                <button
                  key={d.id}
                  onClick={() => ctrl.selectScript(d)}
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>{d.title}</div>
                  <div style={{ fontSize: 10.5, color: "var(--fg-3)", marginTop: 2 }}>{d.genre} · {d.duration_sec}s · {d.scenes?.length ?? 0} 镜</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {ctrl.activeScript && (
        <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--fg-2)" }}>
          <ArrowRight size={14} style={{ color: "var(--accent)" }} />
          已就绪「<b style={{ color: "var(--fg-0)" }}>{ctrl.activeScript.title}</b>」，点右下「下一步」进入分镜剧本。
        </div>
      )}
    </Card>
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
