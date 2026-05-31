"use client";

// useDramaDraft — 短剧创作的共享状态引擎（v0.7）。
// 从原 short-drama/page.tsx 抽出，供「极速模式」与「专业模式」共用同一 DramaScript，
// 切换模式不丢草稿。包含：起草输入 / 工作区脚本 / 分镜 / 角色 / 变体 / 生成任务（轮询） /
// 剧集多集 / 归入项目 / 去分发 全套动作。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShortDramaApi, ArtistsApi } from "@/api";
import type { DramaScript, DramaEpisodeJob, DramaVariant } from "@/api/short-drama";
import type { CastOption } from "@/components/short-drama/character-panel";

export const GENRES = ["都市情感", "甜宠", "逆袭爽剧", "古装", "悬疑", "喜剧"];
export const DURATIONS = [30, 60, 90];
export const DRAFT_COUNTS = [1, 2, 3];
export const CREDIT_PER_VIDEO = 30;

/** 专业模式流水线步骤。 */
export type CreateStep = "inspiration" | "script" | "storyboard" | "cast" | "generate" | "footage" | "review";

export function errMsg(e: unknown, fallback: string): string {
  const err = e as { error?: { message?: string }; message?: string };
  return err?.error?.message ?? err?.message ?? fallback;
}

/** 去掉标题末尾的「第N集」后缀，得到剧集基础名。 */
function baseSeriesTitle(title: string): string {
  return title.replace(/\s*第\s*\d+\s*集\s*$/, "").trim() || title;
}

export interface DramaDraftController {
  // 起草输入
  theme: string;
  setTheme: (v: string) => void;
  genre: string;
  setGenre: (v: string) => void;
  duration: number;
  setDuration: (v: number) => void;
  draftCount: number;
  setDraftCount: (v: number) => void;
  drafting: boolean;
  draftError: string | null;
  drafts: DramaScript[];
  // 工作区
  activeScript: DramaScript | null;
  setActiveScript: React.Dispatch<React.SetStateAction<DramaScript | null>>;
  update: (patch: Partial<DramaScript>) => void;
  saving: boolean;
  generating: boolean;
  publishing: boolean;
  variants: DramaVariant[];
  setVariants: (v: DramaVariant[]) => void;
  genCount: number;
  setGenCount: (n: number) => void;
  jobs: DramaEpisodeJob[];
  savedScripts: DramaScript[];
  castOptions: CastOption[];
  seriesEpisodes: DramaScript[];
  creditEstimate: number;
  persisted: boolean;
  // 动作
  handleDraft: () => Promise<void>;
  newBlankScript: () => void;
  selectScript: (s: DramaScript) => void;
  loadSaved: (s: DramaScript) => Promise<void>;
  ensureSaved: () => Promise<DramaScript | null>;
  handleSave: () => Promise<void>;
  handleRewrite: (index: number) => Promise<void>;
  handleGenerate: () => Promise<void>;
  /** 极速模式：一句话 → 起草 → 保存 → 生成 1 条，一气呵成；返回是否成功。 */
  expressRun: () => Promise<boolean>;
  handlePublishToProject: () => Promise<string | null>;
  handleGoDistribute: () => Promise<void>;
  makeSeries: () => Promise<void>;
  addEpisode: () => Promise<void>;
}

export function useDramaDraft(): DramaDraftController {
  const router = useRouter();

  const [theme, setTheme] = React.useState("");
  const [genre, setGenre] = React.useState(GENRES[0]);
  const [duration, setDuration] = React.useState(60);
  const [draftCount, setDraftCount] = React.useState(1);
  const [drafting, setDrafting] = React.useState(false);
  const [draftError, setDraftError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<DramaScript[]>([]);

  const [activeScript, setActiveScript] = React.useState<DramaScript | null>(null);
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
  const persisted = activeScript
    ? !activeScript.id.startsWith("ds_new_") && !activeScript.id.startsWith("ds_mock_")
    : false;

  function selectScript(s: DramaScript) {
    setActiveScript(s);
    setVariants([]);
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
      if (result.length > 0) selectScript(result[0]);
    } catch (e) {
      setDraftError(errMsg(e, "脚本生成失败，请稍后重试"));
    } finally {
      setDrafting(false);
    }
  }

  function newBlankScript() {
    const id = `ds_new_${Date.now()}`;
    selectScript({
      id,
      title: "未命名短剧",
      genre,
      duration_sec: duration,
      aspect_ratio: "9:16",
      status: "draft",
      scenes: [{ heading: "", summary: "", shot: "", dialogue: "", duration_sec: 12, shot_type: "medium", camera_move: "static", gen_voice: true }],
      characters: [],
      style: { visual: "电影感", palette: "暖色", pace: "快节奏" },
    });
    setDrafts([]);
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
      setActiveScript((prev) => (prev ? { ...prev, scenes: prev.scenes.map((s, i) => (i === index ? { ...s, ...scene } : s)) } : prev));
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
      toast.success(`已提交 ${created.length} 条短剧视频，正在生成`);
    } catch (e) {
      toast.error(errMsg(e, "短剧视频生成失败"));
    } finally {
      setGenerating(false);
    }
  }

  async function expressRun(): Promise<boolean> {
    if (!theme.trim()) {
      toast.error("先写一句短剧主题或灵感");
      return false;
    }
    setDrafting(true);
    setDraftError(null);
    try {
      const result = await ShortDramaApi.aiDraftScripts({ theme: theme.trim(), genre, durationSec: duration, count: 1 });
      if (result.length === 0) {
        setDraftError("未能生成脚本，请换个描述重试");
        return false;
      }
      setDrafts(result);
      const saved = await ShortDramaApi.saveScript(result[0]);
      setActiveScript(saved);
      setSavedScripts((prev) => [saved, ...prev.filter((s) => s.id !== saved.id)]);
      setGenerating(true);
      const created = await ShortDramaApi.generateEpisodes({ scriptId: saved.id, name: saved.title, count: 1 });
      setJobs(created);
      toast.success("已提交生成，正在出片");
      return true;
    } catch (e) {
      setDraftError(errMsg(e, "极速生成失败，请稍后重试"));
      return false;
    } finally {
      setDrafting(false);
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

  async function makeSeries() {
    const saved = await ensureSaved();
    if (!saved) return;
    const seriesId = saved.series_id || `series_${saved.id}`;
    const next = { ...saved, series_id: seriesId, episode_no: saved.episode_no || 1 };
    setActiveScript(next);
    const persistedSeries = await ShortDramaApi.saveScript(next).catch(() => null);
    if (persistedSeries) {
      setActiveScript(persistedSeries);
      ShortDramaApi.listSeriesEpisodes(seriesId).then(setSeriesEpisodes).catch(() => {});
      toast.success("已设为剧集第 1 集");
    }
  }

  async function addEpisode() {
    if (!activeScript?.series_id) return;
    const nextNo = seriesEpisodes.reduce((m, e) => Math.max(m, e.episode_no ?? 0), activeScript.episode_no ?? 0) + 1;
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
    const saved = await ShortDramaApi.saveScript(draft).catch((e) => {
      toast.error(errMsg(e, "新增一集失败"));
      return null;
    });
    if (saved) {
      setSavedScripts((prev) => [saved, ...prev]);
      ShortDramaApi.listSeriesEpisodes(activeScript.series_id).then(setSeriesEpisodes).catch(() => {});
      selectScript(saved);
      toast.success(`已新增第 ${nextNo} 集`);
    }
  }

  return {
    theme, setTheme, genre, setGenre, duration, setDuration, draftCount, setDraftCount,
    drafting, draftError, drafts,
    activeScript, setActiveScript, update, saving, generating, publishing,
    variants, setVariants, genCount, setGenCount, jobs, savedScripts, castOptions, seriesEpisodes,
    creditEstimate, persisted,
    handleDraft, newBlankScript, selectScript, loadSaved, ensureSaved, handleSave,
    handleRewrite, handleGenerate, expressRun, handlePublishToProject, handleGoDistribute, makeSeries, addEpisode,
  };
}
