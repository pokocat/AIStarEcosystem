"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, FileText, Sparkles, Trash2, Wand2 } from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import { Button, Card, KpiCard } from "@/components/premium";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  SectionHeader,
  Select,
  StatusBadge,
  TextArea,
  TextInput,
  ViewHeader,
} from "@/components/common";
import { ArtistsApi } from "@/api";
import { invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";

const STORAGE_KEY = "drama:incubator:drafts";

interface IncubatorDraft {
  id: string;
  name: string;
  type: Artist["type"];
  quality: Artist["quality"];
  voice: "warm" | "cool" | "ethereal" | "bright";
  personality: string;
  appearance: string;
  step: 1 | 2 | 3;
  createdAt: string;
}

const TYPES: Array<{ value: Artist["type"]; label: string }> = [
  { value: "actor", label: "演员" },
  { value: "all_rounder", label: "全能型" },
  { value: "dancer", label: "舞者 / 配演" },
];

const QUALITIES: Array<{ value: Artist["quality"]; label: string }> = [
  { value: "legendary", label: "S 类 · Legendary" },
  { value: "epic", label: "A 类 · Epic" },
  { value: "rare", label: "B 类 · Rare" },
];

const VOICES = [
  { value: "warm" as const, label: "温润 · 低音" },
  { value: "cool" as const, label: "清冷 · 中音" },
  { value: "ethereal" as const, label: "空灵 · 高音" },
  { value: "bright" as const, label: "明亮 · 少年感" },
];

function emptyDraft(): IncubatorDraft {
  return {
    id: `dr-${Date.now()}`,
    name: "",
    type: "actor",
    quality: "epic",
    voice: "warm",
    personality: "",
    appearance: "",
    step: 1,
    createdAt: new Date().toISOString(),
  };
}

function loadDrafts(): IncubatorDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IncubatorDraft[]) : [];
  } catch {
    return [];
  }
}

function saveDrafts(arr: IncubatorDraft[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export default function IncubatorPage() {
  const router = useRouter();
  const [drafts, setDrafts] = React.useState<IncubatorDraft[]>([]);
  const [active, setActive] = React.useState<IncubatorDraft | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [delTarget, setDelTarget] = React.useState<IncubatorDraft | null>(null);

  React.useEffect(() => {
    setDrafts(loadDrafts());
  }, []);

  function persist(next: IncubatorDraft[]) {
    setDrafts(next);
    saveDrafts(next);
  }

  function startNew() {
    const d = emptyDraft();
    setActive(d);
    persist([d, ...drafts.filter((x) => x.id !== d.id)]);
  }

  function updateActive(patch: Partial<IncubatorDraft>) {
    if (!active) return;
    const next: IncubatorDraft = { ...active, ...patch };
    setActive(next);
    persist(drafts.map((d) => (d.id === next.id ? next : d)));
  }

  async function finalize() {
    if (!active) return;
    if (!active.name.trim()) {
      toast.error("请先填写艺名");
      return;
    }
    setSubmitting(true);
    try {
      const a = await ArtistsApi.createArtist({
        name: active.name.trim(),
        type: active.type,
        quality: active.quality,
        status: "trainee",
        bio:
          (active.personality.trim() || "孵化营新入驻演员") +
          (active.appearance.trim() ? `。形象：${active.appearance.trim()}` : ""),
      });
      invalidate("/me/artists");
      // 移除草稿
      persist(drafts.filter((d) => d.id !== active.id));
      setActive(null);
      toast.success(`${a.name} 已加入阵容，状态：训练中`);
      router.push(`/cast/${encodeURIComponent(a.id)}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "孵化失败");
    } finally {
      setSubmitting(false);
    }
  }

  function deleteDraft() {
    if (!delTarget) return;
    persist(drafts.filter((d) => d.id !== delTarget.id));
    if (active?.id === delTarget.id) setActive(null);
    toast.success("草稿已删除");
  }

  function cloneDraft(d: IncubatorDraft) {
    const cloned: IncubatorDraft = {
      ...d,
      id: `dr-${Date.now()}`,
      name: `${d.name}（副本）`,
      createdAt: new Date().toISOString(),
      step: 1,
    };
    persist([cloned, ...drafts]);
    toast.success("已克隆草稿");
  }

  const steps: Array<{ id: 1 | 2 | 3; label: string }> = [
    { id: 1, label: "基础档案" },
    { id: 2, label: "形象参数" },
    { id: 3, label: "性格与音色" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="incubator"
        title={
          <>
            孵化{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              新演员
            </span>
          </>
        }
        meta={`本地草稿 ${drafts.length} 份 · 完成后入驻阵容`}
        action={
          <Button variant="primary" size="md" onClick={startNew}>
            <Sparkles size={14} />
            新建孵化
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <KpiCard label="本地草稿" value={String(drafts.length)} tone="violet" />
        <KpiCard label="进行中" value={String(drafts.filter((d) => d.step < 3).length)} tone="info" />
        <KpiCard label="待出炉" value={String(drafts.filter((d) => d.step === 3).length)} tone="accent" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        {/* 草稿列表 */}
        <Card style={{ padding: "22px 24px" }}>
          <SectionHeader eyebrow="drafts" title="我的草稿" />
          {drafts.length === 0 && (
            <EmptyState
              icon={<FileText size={24} />}
              title="还没有草稿"
              description="点击右上「新建孵化」开始一个新角色。"
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {drafts.map((d) => (
              <div
                key={d.id}
                onClick={() => setActive(d)}
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-md)",
                  background:
                    active?.id === d.id
                      ? "color-mix(in srgb, var(--accent) 10%, transparent)"
                      : "rgba(255,255,255,0.02)",
                  border:
                    active?.id === d.id
                      ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)"
                      : "1px solid var(--line)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, fontFamily: "var(--font-display)" }}>
                    {d.name || "未命名草稿"}
                  </div>
                  <StatusBadge tone={d.step === 3 ? "success" : "info"}>步骤 {d.step}/3</StatusBadge>
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.3 }}>
                  {new Date(d.createdAt).toLocaleString("zh-CN")}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      cloneDraft(d);
                    }}
                  >
                    克隆
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDelTarget(d);
                    }}
                  >
                    <Trash2 size={11} />
                    删除
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* 编辑器 */}
        <Card style={{ padding: "24px 26px" }}>
          {!active && (
            <EmptyState
              icon={<Wand2 size={28} />}
              title="选择一份草稿开始编辑"
              description="或新建一个新的孵化档案。"
              action={
                <Button variant="primary" size="md" onClick={startNew}>
                  <Sparkles size={14} />
                  新建孵化
                </Button>
              }
            />
          )}
          {active && (
            <>
              <SectionHeader eyebrow="multi-step form" title={`孵化「${active.name || "未命名"}」`} />
              {/* Steps */}
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                {steps.map((s) => {
                  const done = active.step > s.id;
                  const current = active.step === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => updateActive({ step: s.id })}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: "var(--radius-md)",
                        background: current
                          ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                          : done
                            ? "rgba(76,224,160,0.10)"
                            : "rgba(255,255,255,0.02)",
                        border: current
                          ? "1px solid color-mix(in srgb, var(--accent) 35%, transparent)"
                          : "1px solid var(--line-2)",
                        color: current ? "var(--accent)" : done ? "var(--success)" : "var(--fg-2)",
                        fontSize: 12,
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: done ? "var(--success)" : "rgba(255,255,255,0.06)",
                          color: done ? "#0a0810" : "var(--fg-2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {done ? <Check size={11} /> : s.id}
                      </div>
                      {s.label}
                    </button>
                  );
                })}
              </div>

              {active.step === 1 && (
                <>
                  <Field label="艺名" required>
                    <TextInput
                      value={active.name}
                      onChange={(e) => updateActive({ name: e.target.value })}
                      maxLength={32}
                      placeholder="如：苏念"
                    />
                  </Field>
                  <Field label="类型">
                    <Select
                      value={active.type}
                      onChange={(e) => updateActive({ type: e.target.value as Artist["type"] })}
                    >
                      {TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="级别">
                    <Select
                      value={active.quality}
                      onChange={(e) => updateActive({ quality: e.target.value as Artist["quality"] })}
                    >
                      {QUALITIES.map((q) => (
                        <option key={q.value} value={q.value}>
                          {q.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}

              {active.step === 2 && (
                <Field label="形象描述" hint="脸型 / 发型 / 妆容 / 穿衣风格，越具体越稳。">
                  <TextArea
                    rows={8}
                    value={active.appearance}
                    onChange={(e) => updateActive({ appearance: e.target.value })}
                    maxLength={500}
                    placeholder="如：清冷少年感，黑色长发，下颌线锐利，常穿米白色风衣……"
                  />
                </Field>
              )}

              {active.step === 3 && (
                <>
                  <Field label="性格关键词">
                    <TextArea
                      rows={4}
                      value={active.personality}
                      onChange={(e) => updateActive({ personality: e.target.value })}
                      maxLength={200}
                      placeholder="如：冷静、隐忍、雨天会沉默"
                    />
                  </Field>
                  <Field label="音色">
                    <Select
                      value={active.voice}
                      onChange={(e) => updateActive({ voice: e.target.value as IncubatorDraft["voice"] })}
                    >
                      {VOICES.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 18 }}>
                <Button
                  variant="ghost"
                  size="md"
                  disabled={active.step === 1}
                  onClick={() => updateActive({ step: (active.step - 1) as IncubatorDraft["step"] })}
                >
                  上一步
                </Button>
                {active.step < 3 ? (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => updateActive({ step: (active.step + 1) as IncubatorDraft["step"] })}
                  >
                    下一步
                  </Button>
                ) : (
                  <Button variant="primary" size="md" loading={submitting} onClick={finalize}>
                    <Sparkles size={14} />
                    出炉，加入阵容
                  </Button>
                )}
              </div>
            </>
          )}
        </Card>
      </div>

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="删除草稿"
        description={`将删除「${delTarget?.name || "未命名"}」，不可恢复。`}
        destructive
        confirmLabel="删除"
        onConfirm={deleteDraft}
      />
    </div>
  );
}
