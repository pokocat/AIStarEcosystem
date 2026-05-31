"use client";

export const dynamic = "force-dynamic";

// 短剧生成 · 完整创作工作流（v0.45）
// 题材灵感 → AI 多稿起草 → 分场景编辑（增删改/调序/逐镜重写/景别·运镜·配音）→ 角色与演员绑定 →
// 剧集(多集) → 风格与变体生成 → 积分预估 → 生成视频 → 视频库 → 归入项目 / 去分发。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Clapperboard, Coins, FileText, Film, Layers, Plus, Save, Send, Sparkles, Trash2, Users, Wand2 } from "lucide-react";
import { Button, Card, Chip } from "@/components/premium";
import { Field, Select, TextArea, TextInput, ViewHeader, SectionHeader, StatusBadge, EmptyState } from "@/components/common";
import { ShortDramaApi, ArtistsApi } from "@/api";
import type { DramaScript, DramaEpisodeJob, DramaVariant } from "@/api/short-drama";
import { SceneEditor } from "@/components/short-drama/scene-editor";
import { CharacterPanel, type CastOption } from "@/components/short-drama/character-panel";
import { VideoLibrary } from "@/components/short-drama/video-library";

const GENRES = ["都市情感", "甜宠", "逆袭爽剧", "古装", "悬疑", "喜剧"];
const DURATIONS = [30, 60, 90];
const DRAFT_COUNTS = [1, 2, 3];
const CREDIT_PER_VIDEO = 30;

type Stage = "script" | "characters" | "generate" | "library";
const STAGES: { key: Stage; label: string; icon: React.ReactNode }[] = [
  { key: "script", label: "剧本", icon: <FileText size={13} /> },
  { key: "characters", label: "角色", icon: <Users size={13} /> },
  { key: "generate", label: "生成", icon: <Sparkles size={13} /> },
  { key: "library", label: "视频库", icon: <Film size={13} /> },
];

export default function ShortDramaPage() {
  const router = useRouter();

  // 起草输入
  const [theme, setTheme] = React.useState("");
  const [genre, setGenre] = React.useState(GENRES[0]);
  const [duration, setDuration] = React.useState(60);
  const [draftCount, setDraftCount] = React.useState(1);
  const [drafting, setDrafting] = React.useState(false);
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<DramaScript[]>([]);

  // 工作区
  const [activeScript, setActiveScript] = React.useState<DramaScript | null>(null);
  const [stage, setStage] = React.useState<Stage>("script");
  const [saving, setSaving] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [publishing, setPublishing] = React.useState(false);
  const [variants, setVariants] = React.useState<DramaVariant[]>([]);
  const [genCount, setGenCount] = React.useState(1);
  const [jobs, setJobs] = React.useState<DramaEpisodeJob[]>([]);

  const [savedScripts, setSavedScripts] = React.useState<DramaScript[]>([]);
  const [castOptions, setCastOptions] = React.useState<CastOption[]>([]);
  const [seriesEpisodes, setSeriesEpisodes] = React.useState<DramaScript[]>([]);

  React.useEffect(() => {
    ShortDramaApi.listScripts().then(setSavedScripts).catch(() => {});
    ArtistsApi.listArtists()
      .then((arts) => setCastOptions(arts.map((a) => ({ id: a.id, name: a.name, avatar: a.avatar }))))
      .catch(() => {});
  }, []);

  // 轮询：有任务仍在生成时每 3.5s 刷新
  const anyRendering = jobs.some((j) => j.status !== "ready" && j.status !== "failed");
  React.useEffect(() => {
    if (!anyRendering || !activeScript) return;
    const t = setInterval(async () => {
      try {
        const fresh = await ShortDramaApi.listEpisodeJobs(activeScript.id);
        if (fresh.length > 0) setJobs(fresh);
      } catch {
        /* 静默重试 */
      }
    }, 3500);
    return () => clearInterval(t);
  }, [anyRendering, activeScript]);

  // 剧集列表
  React.useEffect(() => {
    if (activeScript?.series_id) {
      ShortDramaApi.listSeriesEpisodes(activeScript.series_id).then(setSeriesEpisodes).catch(() => setSeriesEpisodes([]));
    } else {
      setSeriesEpisodes([]);
    }
  }, [activeScript?.series_id, activeScript?.id]);

  function update(patch: Partial<DramaScript>) {
    setActiveScript((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  const creditEstimate = (variants.length > 0 ? variants.length : genCount) * CREDIT_PER_VIDEO;

  async function ensureSaved(): Promise<DramaScript | null> {
    if (!activeScript) return null;
    try {
      const saved = await ShortDramaApi.saveScript(activeScript);
      setActiveScript(saved);
      setSavedScripts((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
      return saved;
    } catch (e) {
      toast.error(errMsg(e, "脚本保存失败"));
      return null;
    }
  }

  async function handleDraft() {
    if (!theme.trim()) {
      toast.error("先写一句短剧主题或灵感");
      return;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const result = await ShortDramaApi.aiDraftScripts({ theme: theme.trim(), genre, durationSec: duration, count: draftCount });
      setDrafts(result);
      if (result.length > 0) {
        selectScript(result[0]);
      }
    } catch (e) {
      setDraftError(errMsg(e, "脚本生成失败，请稍后重试"));
    } finally {
      setDrafting(false);
    }
  }

  function newBlankScript() {
    const id = `ds_new_${Date.now()}`;
    selectScript({
      id, title: "未命名短剧", genre, duration_sec: duration, aspect_ratio: "9:16", status: "draft",
      scenes: [{ heading: "", summary: "", shot: "", dialogue: "", duration_sec: 12, shot_type: "medium", camera_move: "static", gen_voice: true }],
      characters: [], style: { visual: "电影感", palette: "暖色", pace: "快节奏" },
    });
    setDrafts([]);
  }

  function selectScript(s: DramaScript) {
    setActiveScript(s);
    setVariants([]);
    setStage("script");
    setJobs([]);
    setDraftError(null);
    if (s.id && !s.id.startsWith("ds_new_") && !s.id.startsWith("ds_mock_")) {
      ShortDramaApi.listEpisodeJobs(s.id).then(setJobs).catch(() => setJobs([]));
    }
  }

  async function loadSaved(s: DramaScript) {
    try {
      const full = await ShortDramaApi.getScript(s.id);
      selectScript(full ?? s);
    } catch {
      selectScript(s);
    }
  }

  async function handleSave() {
    setSaving(true);
    const saved = await ensureSaved();
    setSaving(false);
    if (saved) toast.success("脚本已保存");
  }

  async function handleRewrite(index: number) {
    const saved = await ensureSaved();
    if (!saved) return;
    try {
      const scene = await ShortDramaApi.rewriteScene({ scriptId: saved.id, sceneIndex: index });
      setActiveScript((prev) => prev ? { ...prev, scenes: prev.scenes.map((s, i) => (i === index ? { ...s, ...scene } : s)) } : prev);
      toast.success(`第 ${index + 1} 镜已改写`);
    } catch (e) {
      toast.error(errMsg(e, "单镜改写失败"));
    }
  }

  async function handleGenerate() {
    const saved = await ensureSaved();
    if (!saved) return;
    setGenerating(true);
    try {
      const created = await ShortDramaApi.generateEpisodes({
        scriptId: saved.id,
        name: saved.title,
        count: variants.length > 0 ? undefined : genCount,
        variants: variants.length > 0 ? variants : undefined,
      });
      setJobs((prev) => [...created, ...prev]);
      setStage("library");
      toast.success(`已提交 ${created.length} 条短剧视频，正在生成`);
    } catch (e) {
      toast.error(errMsg(e, "短剧视频生成失败"));
    } finally {
      setGenerating(false);
    }
  }

  async function handlePublishToProject(): Promise<string | null> {
    const saved = await ensureSaved();
    if (!saved) return null;
    setPublishing(true);
    try {
      const drama = await ShortDramaApi.publishToProject(saved.id);
      update({ drama_id: drama.id });
      toast.success(`已归入项目「${drama.title}」`);
      return drama.id;
    } catch (e) {
      toast.error(errMsg(e, "归入项目失败"));
      return null;
    } finally {
      setPublishing(false);
    }
  }

  async function handleGoDistribute() {
    const dramaId = activeScript?.drama_id ?? (await handlePublishToProject());
    if (dramaId) router.push(`/projects/${dramaId}/distribute`);
  }

  // ── 剧集（多集）──────────────────────────────────────────────────────────
  async function makeSeries() {
    const saved = await ensureSaved();
    if (!saved) return;
    const seriesId = saved.series_id || `series_${saved.id}`;
    const next = { ...saved, series_id: seriesId, episode_no: saved.episode_no || 1 };
    setActiveScript(next);
    const persisted = await ShortDramaApi.saveScript(next).catch(() => null);
    if (persisted) {
      setActiveScript(persisted);
      ShortDramaApi.listSeriesEpisodes(seriesId).then(setSeriesEpisodes).catch(() => {});
      toast.success("已设为剧集第 1 集");
    }
  }

  async function addEpisode() {
    if (!activeScript?.series_id) return;
    const nextNo = (seriesEpisodes.reduce((m, e) => Math.max(m, e.episode_no ?? 0), activeScript.episode_no ?? 0)) + 1;
    const draft: DramaScript = {
      id: `ds_new_${Date.now()}`,
      title: `${baseSeriesTitle(activeScript.title)} 第${nextNo}集`,
      genre: activeScript.genre,
      duration_sec: activeScript.duration_sec,
      aspect_ratio: activeScript.aspect_ratio,
      status: "draft",
      series_id: activeScript.series_id,
      episode_no: nextNo,
      characters: activeScript.characters,
      style: activeScript.style,
      scenes: [{ heading: "", summary: "", shot: "", dialogue: "", duration_sec: 12, shot_type: "medium", camera_move: "static", gen_voice: true }],
    };
    const saved = await ShortDramaApi.saveScript(draft).catch((e) => { toast.error(errMsg(e, "新增一集失败")); return null; });
    if (saved) {
      setSavedScripts((prev) => [saved, ...prev]);
      ShortDramaApi.listSeriesEpisodes(activeScript.series_id).then(setSeriesEpisodes).catch(() => {});
      selectScript(saved);
      toast.success(`已新增第 ${nextNo} 集`);
    }
  }

  const persisted = activeScript ? !activeScript.id.startsWith("ds_new_") && !activeScript.id.startsWith("ds_mock_") : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="短剧生成"
        title={<>短剧{" "}<span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>创作工作流</span></>}
        meta="题材灵感 → AI 起草 → 分场景编辑 → 角色与演员 → 生成视频 → 归入项目分发"
      />

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 16, alignItems: "start" }}>
        {/* 左：起草 + 脚本列表 + 剧集 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: "22px", display: "flex", flexDirection: "column", gap: 4 }}>
            <SectionHeader eyebrow="AI 起草" title="一句话生成脚本" />
            <Field label="短剧主题 / 灵感" hint="越具体，脚本越贴合。">
              <TextArea rows={4} value={theme} onChange={(e) => setTheme(e.target.value)} maxLength={300} placeholder="如：外卖小哥其实是隐藏总裁，雨夜送餐救下落难前女友。" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="题材">
                <Select value={genre} onChange={(e) => setGenre(e.target.value)}>{GENRES.map((g) => <option key={g} value={g}>{g}</option>)}</Select>
              </Field>
              <Field label="时长">
                <Select value={String(duration)} onChange={(e) => setDuration(Number(e.target.value))}>{DURATIONS.map((d) => <option key={d} value={d}>{d} 秒</option>)}</Select>
              </Field>
            </div>
            <Field label="起草版本数">
              <Select value={String(draftCount)} onChange={(e) => setDraftCount(Number(e.target.value))}>{DRAFT_COUNTS.map((n) => <option key={n} value={n}>{n} 稿</option>)}</Select>
            </Field>
            <Button variant="primary" size="lg" loading={drafting} onClick={handleDraft} disabled={drafting}>
              <Wand2 size={14} />{drafting ? "起草中…" : "AI 起草脚本"}
            </Button>
            <Button variant="ghost" size="md" onClick={newBlankScript}>
              <Plus size={13} /> 手动新建空白脚本
            </Button>
            {draftError && <div style={errorBoxStyle}>{draftError}</div>}
          </Card>

          {drafts.length > 1 && (
            <Card style={{ padding: "18px 22px" }}>
              <SectionHeader eyebrow="多稿" title="选择一个草稿" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                {drafts.map((d) => (
                  <ScriptRow key={d.id} script={d} active={activeScript?.id === d.id} onClick={() => selectScript(d)} />
                ))}
              </div>
            </Card>
          )}

          {savedScripts.length > 0 && (
            <Card style={{ padding: "18px 22px" }}>
              <SectionHeader eyebrow="我的脚本" title="已保存脚本" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, maxHeight: 280, overflowY: "auto" }}>
                {savedScripts.map((s) => (
                  <ScriptRow key={s.id} script={s} active={activeScript?.id === s.id} onClick={() => loadSaved(s)} />
                ))}
              </div>
            </Card>
          )}

          {activeScript && (
            <Card style={{ padding: "18px 22px" }}>
              <SectionHeader eyebrow="剧集" title={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Layers size={14} /> 多集管理</span>} />
              {!activeScript.series_id ? (
                <Button variant="secondary" size="md" onClick={makeSeries} style={{ marginTop: 10 }}>
                  设为剧集（第 1 集）
                </Button>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                  {seriesEpisodes.map((ep) => (
                    <ScriptRow key={ep.id} script={ep} active={activeScript.id === ep.id} prefix={`第${ep.episode_no ?? "?"}集 · `} onClick={() => loadSaved(ep)} />
                  ))}
                  <Button variant="ghost" size="md" onClick={addEpisode} style={{ marginTop: 4 }}>
                    <Plus size={13} /> 新增下一集
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* 右：工作区 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {!activeScript ? (
            <Card style={{ padding: "22px 24px", minHeight: 360 }}>
              <EmptyState icon={<Clapperboard size={28} />} title="还没有脚本" description="在左侧写下灵感点「AI 起草脚本」，或「手动新建空白脚本」。拿到脚本后即可编辑分镜、绑定演员、生成短剧视频。" />
            </Card>
          ) : (
            <>
              {/* 头部：标题 + 状态 + 保存 + tab */}
              <Card style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <TextInput value={activeScript.title} onChange={(e) => update({ title: e.target.value })} style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-display)", background: "transparent", border: "none", padding: 0 }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      <StatusBadge tone="accent" dot={false}>{activeScript.genre}</StatusBadge>
                      <StatusBadge tone="neutral" dot={false}>{activeScript.duration_sec}s</StatusBadge>
                      <StatusBadge tone="neutral" dot={false}>{activeScript.scenes?.length ?? 0} 镜</StatusBadge>
                      {activeScript.series_id && <StatusBadge tone="info" dot={false}>第 {activeScript.episode_no ?? 1} 集</StatusBadge>}
                      {activeScript.drama_id && <StatusBadge tone="success" dot={false}>已归入项目</StatusBadge>}
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" loading={saving} onClick={handleSave} disabled={saving}><Save size={12} /> 保存脚本</Button>
                </div>

                <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
                  {STAGES.map((s) => (
                    <button key={s.key} onClick={() => setStage(s.key)} style={tabStyle(stage === s.key)}>
                      {s.icon} {s.label}
                      {s.key === "library" && jobs.length > 0 ? `（${jobs.length}）` : ""}
                    </button>
                  ))}
                </div>
              </Card>

              {/* tab 内容 */}
              {stage === "script" && (
                <Card style={{ padding: "20px 24px" }}>
                  <Field label="一句话简介（logline）">
                    <TextInput value={activeScript.logline ?? ""} onChange={(e) => update({ logline: e.target.value })} placeholder="一句话钩子，统领全剧" />
                  </Field>
                  <SectionHeader eyebrow="分镜" title="分场景编辑" />
                  <div style={{ marginTop: 10 }}>
                    <SceneEditor
                      scenes={activeScript.scenes ?? []}
                      onChange={(scenes) => update({ scenes })}
                      canRewrite={persisted}
                      onRewrite={handleRewrite}
                    />
                    {!persisted && <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 8 }}>提示：保存脚本后可对单镜使用「AI 重写」。</div>}
                  </div>
                </Card>
              )}

              {stage === "characters" && (
                <Card style={{ padding: "20px 24px" }}>
                  <SectionHeader eyebrow="角色" title="角色与演员绑定" right={<StatusBadge tone="neutral" dot={false}>{castOptions.length} 位可用演员</StatusBadge>} />
                  <div style={{ marginTop: 10 }}>
                    <CharacterPanel characters={activeScript.characters ?? []} onChange={(characters) => update({ characters })} castOptions={castOptions} />
                  </div>
                </Card>
              )}

              {stage === "generate" && (
                <Card style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <SectionHeader eyebrow="风格" title="整体风格" />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                    <Field label="视觉"><TextInput value={activeScript.style?.visual ?? ""} onChange={(e) => update({ style: { ...activeScript.style, visual: e.target.value } })} placeholder="电影感 / 纪实" /></Field>
                    <Field label="色调"><TextInput value={activeScript.style?.palette ?? ""} onChange={(e) => update({ style: { ...activeScript.style, palette: e.target.value } })} placeholder="暖色 / 冷色" /></Field>
                    <Field label="节奏"><TextInput value={activeScript.style?.pace ?? ""} onChange={(e) => update({ style: { ...activeScript.style, pace: e.target.value } })} placeholder="快节奏 / 舒缓" /></Field>
                  </div>

                  <VariantEditor variants={variants} onChange={setVariants} genCount={genCount} onGenCount={setGenCount} />

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fg-2)" }}>
                      <Coins size={15} style={{ color: "var(--accent)" }} />
                      预计消耗 <b style={{ color: "var(--fg-0)" }}>{creditEstimate}</b> 积分 · {variants.length > 0 ? `${variants.length} 个变体` : `${genCount} 条`}
                    </div>
                    <Button variant="primary" size="lg" loading={generating} onClick={handleGenerate} disabled={generating}>
                      <Sparkles size={14} />{generating ? "提交中…" : "生成短剧视频"}
                    </Button>
                  </div>
                </Card>
              )}

              {stage === "library" && (
                <Card style={{ padding: "20px 24px" }}>
                  <SectionHeader
                    eyebrow="视频库"
                    title="短剧成片"
                    right={
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button variant="secondary" size="sm" loading={publishing} onClick={handlePublishToProject} disabled={publishing}>
                          <Send size={12} /> 归入项目
                        </Button>
                        <Button variant="primary" size="sm" onClick={handleGoDistribute}>
                          去分发 →
                        </Button>
                      </div>
                    }
                  />
                  <div style={{ marginTop: 12 }}>
                    <VideoLibrary jobs={jobs} />
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

function VariantEditor({ variants, onChange, genCount, onGenCount }: { variants: DramaVariant[]; onChange: (v: DramaVariant[]) => void; genCount: number; onGenCount: (n: number) => void }) {
  function addVariant() {
    onChange([...variants, { id: `v_${Date.now()}`, label: `风格 ${variants.length + 1}`, overrides: { tone: "", style: {} } }]);
  }
  function patch(i: number, p: Partial<DramaVariant>) {
    onChange(variants.map((v, idx) => (idx === i ? { ...v, ...p } : v)));
  }
  return (
    <div>
      <SectionHeader eyebrow="变体" title="风格变体（可选）" right={<Chip>{variants.length > 0 ? `${variants.length} 个变体` : "未启用"}</Chip>} />
      {variants.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <Field label="生成条数（同一脚本）">
            <Select value={String(genCount)} onChange={(e) => onGenCount(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} 条</option>)}</Select>
          </Field>
          <Button variant="ghost" size="md" onClick={addVariant} style={{ alignSelf: "flex-end" }}><Plus size={13} /> 改用多风格变体</Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {variants.map((v, i) => (
            <div key={v.id} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
              <Field label="变体名"><TextInput value={v.label} onChange={(e) => patch(i, { label: e.target.value })} /></Field>
              <Field label="基调"><TextInput value={v.overrides?.tone ?? ""} onChange={(e) => patch(i, { overrides: { ...v.overrides, tone: e.target.value } })} placeholder="甜宠 / 虐恋" /></Field>
              <Field label="色调"><TextInput value={v.overrides?.style?.palette ?? ""} onChange={(e) => patch(i, { overrides: { ...v.overrides, style: { ...v.overrides?.style, palette: e.target.value } } })} placeholder="暖色 / 冷色" /></Field>
              <button type="button" title="删除变体" onClick={() => onChange(variants.filter((_, idx) => idx !== i))} style={{ width: 30, height: 30, borderRadius: "var(--radius-sm)", border: "1px solid var(--line)", background: "rgba(255,255,255,0.02)", color: "var(--danger)", cursor: "pointer" }}><Trash2 size={13} /></button>
            </div>
          ))}
          <Button variant="ghost" size="md" onClick={addVariant}><Plus size={13} /> 再加一个变体</Button>
        </div>
      )}
    </div>
  );
}

function ScriptRow({ script, active, onClick, prefix }: { script: DramaScript; active: boolean; onClick: () => void; prefix?: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left", padding: "10px 12px", borderRadius: "var(--radius-sm)",
        background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "rgba(255,255,255,0.02)",
        border: active ? "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" : "1px solid var(--line)",
        cursor: "pointer", fontFamily: "var(--font-sans)",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>{prefix}{script.title}</div>
      <div style={{ fontSize: 10.5, color: "var(--fg-3)", marginTop: 2 }}>{script.genre} · {script.duration_sec}s · {script.scenes?.length ?? 0} 镜</div>
    </button>
  );
}

const errorBoxStyle: React.CSSProperties = {
  marginTop: 8, fontSize: 12, color: "var(--danger)",
  background: "color-mix(in srgb, var(--danger) 10%, transparent)",
  border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
  borderRadius: "var(--radius-sm)", padding: "8px 10px", lineHeight: 1.6,
};

function tabStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 13px",
    borderRadius: "var(--radius-sm)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
    fontFamily: "var(--font-sans)",
    background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
    border: active ? "1px solid color-mix(in srgb, var(--accent) 34%, transparent)" : "1px solid var(--line)",
    color: active ? "var(--accent)" : "var(--fg-2)",
  };
}

function errMsg(e: unknown, fallback: string): string {
  const err = e as { error?: { message?: string }; message?: string };
  return err?.error?.message ?? err?.message ?? fallback;
}

/** 去掉标题末尾的「第N集」后缀，得到剧集基础名。 */
function baseSeriesTitle(title: string): string {
  return title.replace(/\s*第\s*\d+\s*集\s*$/, "").trim() || title;
}
