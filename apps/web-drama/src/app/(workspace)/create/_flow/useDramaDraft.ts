"use client";

// useDramaDraft — 短剧创作的共享状态引擎（v0.7.1）。
// 极速 / 专业两模式只是「生成最终脚本的方式」不同，产物是同一份 DramaScript（含人物/分镜/场景），
// 多集时是同一 series 的多个 DramaScript。视频按「一集一任务」单独派发（generateEpisodes 逐集）。
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShortDramaApi, ArtistsApi } from "@/api";
import type { DramaScript, DramaEpisodeJob, DramaVariant } from "@/api/short-drama";
import type { CastOption } from "@/components/short-drama/character-panel";

export const GENRES = ["都市情感", "甜宠", "逆袭爽剧", "古装", "悬疑", "喜剧"];
export const DURATIONS = [30, 60, 90];
export const DRAFT_COUNTS = [1, 2, 3];
export const EPISODE_COUNTS = [1, 2, 3, 4];
export const CREDIT_PER_VIDEO = 30;

/** 专业模式流水线步骤（角色在前；剧本即分镜，不拆分；分镜仅渲染时按场景脚本驱动）。 */
export type CreateStep = "inspiration" | "cast" | "script" | "generate" | "footage" | "review";

export function errMsg(e: unknown, fallback: string): string {
  const err = e as { error?: { message?: string }; message?: string };
  return err?.error?.message ?? err?.message ?? fallback;
}

/** 去掉标题末尾的「第N集」后缀，得到剧集基础名。 */
function baseSeriesTitle(title: string): string {
  return title.replace(/\s*第\s*\d+\s*集\s*$/, "").trim() || title;
}

const isTerminal = (j: DramaEpisodeJob) => j.status === "ready" || j.status === "failed";

export interface DramaDraftController {
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
  /** 当前 activeScript 的视频任务（派生自 jobsByScript）。 */
  jobs: DramaEpisodeJob[];
  jobsByScript: Record<string, DramaEpisodeJob[]>;
  jobsFor: (scriptId: string) => DramaEpisodeJob[];
  savedScripts: DramaScript[];
  castOptions: CastOption[];
  seriesEpisodes: DramaScript[];
  creditEstimate: number;
  persisted: boolean;
  handleDraft: () => Promise<void>;
  newBlankScript: () => void;
  selectScript: (s: DramaScript) => void;
  loadSaved: (s: DramaScript) => Promise<void>;
  ensureSaved: () => Promise<DramaScript | null>;
  handleSave: () => Promise<void>;
  handleRewrite: (index: number) => Promise<void>;
  handleGenerate: () => Promise<void>;
  /** 极速：一次性生成完整脚本包（人物/分镜/场景，多集时为 series）。返回生成的（多集）脚本，按集号升序。 */
  expressGenerate: (episodeCount: number) => Promise<DramaScript[] | null>;
  /** 为某一集单独派发视频生成任务（一集一任务）。 */
  generateForEpisode: (scriptId: string, name?: string) => Promise<void>;
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
  const [jobsByScript, setJobsByScript] = React.useState<Record<string, DramaEpisodeJob[]>>({});

  const [savedScripts, setSavedScripts] = React.useState<DramaScript[]>([]);
  const [castOptions, setCastOptions] = React.useState<CastOption[]>([]);
  const [seriesEpisodes, setSeriesEpisodes] = React.useState<DramaScript[]>([]);

  React.useEffect(() => {
    ShortDramaApi.listScripts().then(setSavedScripts).catch(() => {});
    ArtistsApi.listArtists()
      .then((arts) => setCastOptions(arts.map((a) => ({ id: a.id, name: a.name, avatar: a.avatar }))))
      .catch(() => {});
  }, []);

  // 轮询：任何脚本有未完成任务时每 3.5s 刷新该脚本的任务（支持多集并行）。
  const pollKey = Object.entries(jobsByScript)
    .filter(([, js]) => js.some((j) => !isTerminal(j)))
    .map(([id]) => id)
    .sort()
    .join(",");
  React.useEffect(() => {
    if (!pollKey) return;
    const ids = pollKey.split(",");
    const t = setInterval(async () => {
      for (const id of ids) {
        try {
          const fresh = await ShortDramaApi.listEpisodeJobs(id);
          if (fresh.length > 0) setJobsByScript((prev) => ({ ...prev, [id]: fresh }));
        } catch {
          /* 静默重试 */
        }
      }
    }, 3500);
    return () => clearInterval(t);
  }, [pollKey]);

  React.useEffect(() => {
    if (activeScript?.series_id) {
      ShortDramaApi.listSeriesEpisodes(activeScript.series_id).then(setSeriesEpisodes).catch(() => setSeriesEpisodes([]));
    } else {
      setSeriesEpisodes([]);
    }
  }, [activeScript?.series_id, activeScript?.id]);

  const jobs = React.useMemo(
    () => (activeScript ? jobsByScript[activeScript.id] ?? [] : []),
    [jobsByScript, activeScript],
  );
  const jobsFor = React.useCallback((scriptId: string) => jobsByScript[scriptId] ?? [], [jobsByScript]);

  function update(patch: Partial<DramaScript>) {
    setActiveScript((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  const creditEstimate = (variants.length > 0 ? variants.length : genCount) * CREDIT_PER_VIDEO;
  const persisted = activeScript
    ? !activeScript.id.startsWith("ds_new_") && !activeScript.id.startsWith("ds_mock_")
    : false;

  const isReal = (id: string) => !id.startsWith("ds_new_") && !id.startsWith("ds_mock_");

  function selectScript(s: DramaScript) {
    setActiveScript(s);
    setVariants([]);
    setDraftError(null);
    if (s.id && isReal(s.id)) {
      ShortDramaApi.listEpisodeJobs(s.id)
        .then((js) => setJobsByScript((prev) => ({ ...prev, [s.id]: js })))
        .catch(() => {});
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

  function pushJobs(scriptId: string, created: DramaEpisodeJob[]) {
    setJobsByScript((prev) => ({ ...prev, [scriptId]: [...created, ...(prev[scriptId] ?? [])] }));
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
      pushJobs(saved.id, created);
      toast.success(`已提交 ${created.length} 条短剧视频，正在生成`);
    } catch (e) {
      toast.error(errMsg(e, "短剧视频生成失败"));
    } finally {
      setGenerating(false);
    }
  }

  async function generateForEpisode(scriptId: string, name?: string) {
    try {
      const created = await ShortDramaApi.generateEpisodes({ scriptId, count: 1, name });
      pushJobs(scriptId, created);
    } catch (e) {
      toast.error(errMsg(e, "本集视频生成失败"));
    }
  }

  async function expressGenerate(episodeCount: number): Promise<DramaScript[] | null> {
    if (!theme.trim()) {
      toast.error("先写一句短剧主题或灵感");
      return null;
    }
    const count = Math.max(1, Math.min(episodeCount, 8));
    setDrafting(true);
    setDraftError(null);
    try {
      const base = (await ShortDramaApi.aiDraftScripts({ theme: theme.trim(), genre, durationSec: duration, count: 1 }))[0];
      if (!base) {
        setDraftError("未能生成脚本，请换个描述重试");
        return null;
      }
      const eps: DramaScript[] = [];
      if (count <= 1) {
        eps.push(await ShortDramaApi.saveScript(base));
      } else {
        const seriesId = `series_${Date.now()}`;
        const ep1 = await ShortDramaApi.saveScript({ ...base, series_id: seriesId, episode_no: 1 });
        eps.push(ep1);
        const baseName = baseSeriesTitle(ep1.title);
        for (let n = 2; n <= count; n++) {
          const draftN = (await ShortDramaApi.aiDraftScripts({ theme: `${theme.trim()}（第${n}集）`, genre, durationSec: duration, count: 1 }))[0];
          const epN = await ShortDramaApi.saveScript({
            ...(draftN ?? base),
            title: `${baseName} 第${n}集`,
            series_id: seriesId,
            episode_no: n,
            characters: ep1.characters,
            style: ep1.style,
          });
          eps.push(epN);
        }
      }
      setSavedScripts((prev) => [...eps, ...prev.filter((s) => !eps.some((e) => e.id === s.id))]);
      setActiveScript(eps[0]);
      if (eps[0].series_id) {
        ShortDramaApi.listSeriesEpisodes(eps[0].series_id).then(setSeriesEpisodes).catch(() => {});
      }
      toast.success(count > 1 ? `已生成 ${eps.length} 集脚本` : "已生成完整脚本");
      return eps;
    } catch (e) {
      setDraftError(errMsg(e, "极速生成失败，请稍后重试"));
      return null;
    } finally {
      setDrafting(false);
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
    variants, setVariants, genCount, setGenCount, jobs, jobsByScript, jobsFor, savedScripts, castOptions, seriesEpisodes,
    creditEstimate, persisted,
    handleDraft, newBlankScript, selectScript, loadSaved, ensureSaved, handleSave,
    handleRewrite, handleGenerate, expressGenerate, generateForEpisode, handlePublishToProject, handleGoDistribute, makeSeries, addEpisode,
  };
}
