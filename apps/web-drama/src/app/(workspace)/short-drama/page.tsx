"use client";

export const dynamic = "force-dynamic";

// 短剧生成（v0.43+）：脚本化表达 —— AI 起草分场景脚本 → 保存 → 生成短剧视频（异步轮询）。
// 参考 celebrity 的「商品视频生成脚本方案」，落到短剧语义（场景/分镜/台词）。
import * as React from "react";
import { toast } from "sonner";
import { Clapperboard, Film, Loader2, Save, Sparkles, Wand2 } from "lucide-react";
import { Button, Card } from "@/components/premium";
import { Field, Select, TextArea, ViewHeader, SectionHeader, StatusBadge, EmptyState } from "@/components/common";
import { ShortDramaApi } from "@/api";
import type { DramaScript, DramaEpisodeJob } from "@/api/short-drama";

const GENRES = ["都市情感", "甜宠", "逆袭爽剧", "古装", "悬疑", "喜剧"];
const DURATIONS = [30, 60, 90];

export default function ShortDramaPage() {
  const [theme, setTheme] = React.useState("");
  const [genre, setGenre] = React.useState(GENRES[0]);
  const [duration, setDuration] = React.useState(60);

  const [drafting, setDrafting] = React.useState(false);
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<DramaScript[]>([]);

  const [activeScript, setActiveScript] = React.useState<DramaScript | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [versionCount, setVersionCount] = React.useState(1);
  const [jobs, setJobs] = React.useState<DramaEpisodeJob[]>([]);

  // 已保存脚本（进入页面时拉一次）
  const [savedScripts, setSavedScripts] = React.useState<DramaScript[]>([]);
  React.useEffect(() => {
    ShortDramaApi.listScripts().then(setSavedScripts).catch(() => {});
  }, []);

  // 轮询：有任务仍在生成时每 3.5s 刷新（以 activeScript 维度拉）
  const anyRendering = jobs.some((j) => j.status !== "ready" && j.status !== "failed");
  React.useEffect(() => {
    if (!anyRendering || !activeScript) return;
    const t = setInterval(async () => {
      try {
        const fresh = await ShortDramaApi.listEpisodeJobs(activeScript.id);
        if (fresh.length > 0) setJobs(fresh);
      } catch {
        /* 静默，下一轮重试 */
      }
    }, 3500);
    return () => clearInterval(t);
  }, [anyRendering, activeScript]);

  async function handleDraft() {
    if (!theme.trim()) {
      toast.error("先写一句短剧主题或灵感");
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const result = await ShortDramaApi.aiDraftScripts({ theme: theme.trim(), genre, durationSec: duration, count: 1 });
      setDrafts(result);
      if (result.length > 0) {
        setActiveScript(result[0]);
        setJobs([]);
      }
    } catch (e) {
      setDraftError((e as { error?: { message?: string }; message?: string }).error?.message ?? (e as Error).message ?? "脚本生成失败，请稍后重试");
    } finally {
      setDrafting(false);
    }
  }

  async function handleSave() {
    if (!activeScript) return;
    setSaving(true);
    try {
      const saved = await ShortDramaApi.saveScript(activeScript);
      setActiveScript(saved);
      setSavedScripts((prev) => {
        const rest = prev.filter((s) => s.id !== saved.id);
        return [saved, ...rest];
      });
      toast.success("脚本已保存");
    } catch (e) {
      toast.error((e as Error).message ?? "脚本保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate() {
    if (!activeScript) return;
    // 未保存的草稿先存一次（拿到落库 id 才能生成）
    let script = activeScript;
    if (activeScript.status === "draft") {
      try {
        script = await ShortDramaApi.saveScript(activeScript);
        setActiveScript(script);
        setSavedScripts((prev) => [script, ...prev.filter((s) => s.id !== script.id)]);
      } catch (e) {
        toast.error((e as Error).message ?? "脚本保存失败，无法生成");
        return;
      }
    }
    setGenerating(true);
    try {
      const created = await ShortDramaApi.generateEpisodes({ scriptId: script.id, count: versionCount, name: script.title });
      setJobs((prev) => [...created, ...prev]);
      toast.success(`已提交 ${created.length} 条短剧视频，正在生成`);
    } catch (e) {
      toast.error((e as { error?: { message?: string }; message?: string }).error?.message ?? (e as Error).message ?? "短剧视频生成失败");
    } finally {
      setGenerating(false);
    }
  }

  function loadSaved(s: DramaScript) {
    setActiveScript(s);
    setDrafts([]);
    setDraftError(null);
    ShortDramaApi.listEpisodeJobs(s.id).then(setJobs).catch(() => setJobs([]));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="短剧生成"
        title={
          <>
            短剧{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              生成
            </span>
          </>
        }
        meta="灵感 → AI 起草脚本 → 保存 → 生成短剧视频"
      />

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
        {/* 左：起草 + 已保存 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: "22px 22px", display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionHeader eyebrow="AI 起草" title="一句话生成脚本" />
            <Field label="短剧主题 / 灵感" hint="越具体，脚本越贴合。">
              <TextArea
                rows={4}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                maxLength={300}
                placeholder="如：外卖小哥其实是隐藏总裁，雨夜送餐救下落难前女友。"
              />
            </Field>
            <Field label="题材">
              <Select value={genre} onChange={(e) => setGenre(e.target.value)}>
                {GENRES.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </Field>
            <Field label="时长">
              <Select value={String(duration)} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{d} 秒</option>
                ))}
              </Select>
            </Field>
            <Button variant="primary" size="lg" loading={drafting} onClick={handleDraft} disabled={drafting}>
              <Wand2 size={14} />
              {drafting ? "起草中…" : "AI 起草脚本"}
            </Button>
            {draftError && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--danger)", background: "color-mix(in srgb, var(--danger) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)", borderRadius: "var(--radius-sm)", padding: "8px 10px", lineHeight: 1.6 }}>
                {draftError}
              </div>
            )}
          </Card>

          {savedScripts.length > 0 && (
            <Card style={{ padding: "20px 22px" }}>
              <SectionHeader eyebrow="我的脚本" title="已保存脚本" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {savedScripts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadSaved(s)}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      background: activeScript?.id === s.id ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "rgba(255,255,255,0.02)",
                      border: activeScript?.id === s.id ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--line)",
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>{s.title}</div>
                    <div style={{ fontSize: 10.5, color: "var(--fg-3)", marginTop: 2 }}>{s.genre} · {s.duration_sec}s · {s.scenes?.length ?? 0} 场</div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* 右：脚本预览 + 生成 + 视频 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!activeScript ? (
            <Card style={{ padding: "22px 24px", minHeight: 360 }}>
              <EmptyState
                icon={<Clapperboard size={28} />}
                title="还没有脚本"
                description="在左侧写下灵感，点「AI 起草脚本」，几秒后就能拿到一版分场景脚本，再一键生成短剧视频。"
              />
            </Card>
          ) : (
            <>
              <Card style={{ padding: "22px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)" }}>{activeScript.title}</div>
                    {activeScript.logline && <div style={{ fontSize: 12.5, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.6 }}>{activeScript.logline}</div>}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <StatusBadge tone="accent" dot={false}>{activeScript.genre}</StatusBadge>
                      <StatusBadge tone="neutral" dot={false}>{activeScript.duration_sec}s</StatusBadge>
                      <StatusBadge tone="neutral" dot={false}>{activeScript.scenes?.length ?? 0} 个场景</StatusBadge>
                      {activeScript.status === "draft" && <StatusBadge tone="warning" dot={false}>草稿未保存</StatusBadge>}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" loading={saving} onClick={handleSave} disabled={saving}>
                    <Save size={12} />
                    保存脚本
                  </Button>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(activeScript.scenes ?? []).map((sc, i) => (
                    <div key={i} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", padding: "12px 14px", background: "rgba(255,255,255,0.02)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span className="mono" style={{ fontSize: 10, color: "var(--accent)" }}>镜 {String(i + 1).padStart(2, "0")}</span>
                        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{sc.heading}</span>
                        {sc.duration_sec > 0 && <span style={{ fontSize: 10.5, color: "var(--fg-3)" }}>· {sc.duration_sec}s</span>}
                      </div>
                      {sc.summary && <div style={{ fontSize: 12.5, color: "var(--fg-1)", lineHeight: 1.6 }}>{sc.summary}</div>}
                      {sc.dialogue && <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 4, lineHeight: 1.6 }}>🗣 {sc.dialogue}</div>}
                      {sc.shot && <div style={{ fontSize: 11.5, color: "var(--fg-3)", marginTop: 4, lineHeight: 1.6 }}>🎬 {sc.shot}</div>}
                    </div>
                  ))}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                  <div style={{ flex: 1 }}>
                    <Field label="生成版本数">
                      <Select value={String(versionCount)} onChange={(e) => setVersionCount(Number(e.target.value))}>
                        {[1, 2, 3].map((n) => (
                          <option key={n} value={n}>{n} 版</option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Button variant="primary" size="lg" loading={generating} onClick={handleGenerate} disabled={generating} style={{ alignSelf: "flex-end" }}>
                    <Sparkles size={14} />
                    {generating ? "提交中…" : "生成短剧视频"}
                  </Button>
                </div>
              </Card>

              {jobs.length > 0 && (
                <Card style={{ padding: "22px 24px" }}>
                  <SectionHeader
                    eyebrow="results"
                    title="生成的短剧视频"
                    right={anyRendering ? <StatusBadge tone="info">生成中…</StatusBadge> : <StatusBadge tone="success">{jobs.length} 条</StatusBadge>}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginTop: 8 }}>
                    {jobs.map((job) => (
                      <EpisodeCard key={job.id} job={job} />
                    ))}
                  </div>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EpisodeCard({ job }: { job: DramaEpisodeJob }) {
  const ready = job.status === "ready";
  const failed = job.status === "failed";
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden", background: "rgba(255,255,255,0.02)" }}>
      <div style={{ aspectRatio: "9 / 16", background: "#0d0b08", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {ready && job.video_url ? (
          <video src={job.video_url} controls style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : failed ? (
          <div style={{ textAlign: "center", padding: 16, color: "var(--danger)", fontSize: 12, lineHeight: 1.6 }}>
            <Film size={22} style={{ marginBottom: 8, opacity: 0.7 }} />
            <div>{job.error_message || "生成失败，请重试"}</div>
          </div>
        ) : (
          <div style={{ textAlign: "center", color: "var(--fg-3)", fontSize: 12 }}>
            <Loader2 size={20} className="animate-spin" style={{ marginBottom: 8 }} />
            <div>{job.stage || "生成中"}{typeof job.progress_pct === "number" ? ` · ${job.progress_pct}%` : ""}</div>
          </div>
        )}
      </div>
      <div style={{ padding: "10px 12px" }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{job.name}</div>
        <div style={{ fontSize: 10.5, color: ready ? "var(--accent)" : failed ? "var(--danger)" : "var(--fg-3)", marginTop: 2 }}>
          {ready ? "已生成 · 可下载分发" : failed ? "生成失败" : job.stage || "处理中"}
        </div>
      </div>
    </div>
  );
}
