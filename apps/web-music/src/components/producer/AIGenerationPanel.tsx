"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Music2, Loader2, CheckCircle2, AlertTriangle, RefreshCcw, Wand2,
} from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Textarea } from "@ai-star-eco/ui/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@ai-star-eco/ui/ui/select";
import { formatCredits } from "@/lib/format";
import type { MusicGenJob, MusicGenModelOption } from "@ai-star-eco/types/music";
import { MusicGenApi } from "@/api";
import {
  GENRE_OPTIONS, MOOD_OPTIONS, TIMBRE_OPTIONS, GENDER_OPTIONS,
  VOCAL_DURATION, BGM_DURATION, COMPOSE_MODES, LYRIC_TAGS, formatDuration,
  type ComposeMode,
} from "@/constants/music-gen-ui";

interface Props {
  /** 选中的签约艺人。可空：不绑定艺人也能创作与入库。 */
  artistId?: string | null;
  artistName?: string | null;
  /** 预填灵感（例如由外部模板点击注入）。变更时通过 key 重挂载。 */
  initialPrompt?: string;
  /** 作品落库后通知外层刷新列表。歌曲由服务端在生成成功时创建，前端不再自己拼 Song。 */
  onSongCreated?: (songId: string) => void;
}

/** 生成中的阶段文案 —— 依据真实进度推导，不编造。 */
function stageLabel(job: MusicGenJob | null): string {
  if (!job) return "";
  switch (job.status) {
    case "queued": return "已排队，等待模型空闲";
    case "submitting": return "正在提交创作请求";
    case "generating": return job.progress >= 96 ? "正在转存音频" : "模型正在谱曲演唱";
    case "succeeded": return "创作完成";
    case "failed": return "创作失败";
    default: return "";
  }
}

export function AIGenerationPanel({ artistId, artistName, initialPrompt, onSongCreated }: Props) {
  const [mode, setMode] = React.useState<ComposeMode>("inspiration");
  const [prompt, setPrompt] = React.useState(initialPrompt ?? "");
  const [lyrics, setLyrics] = React.useState("");
  const [genre, setGenre] = React.useState<string>("");
  const [mood, setMood] = React.useState<string>("");
  const [timbre, setTimbre] = React.useState<string>("");
  const [gender, setGender] = React.useState<string>("");
  const [durationSec, setDurationSec] = React.useState<number>(VOCAL_DURATION.default);

  const [models, setModels] = React.useState<MusicGenModelOption[]>([]);
  const [endpointId, setEndpointId] = React.useState<string>("");
  const [modelsLoaded, setModelsLoaded] = React.useState(false);

  const [job, setJob] = React.useState<MusicGenJob | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const abortRef = React.useRef<AbortController | null>(null);
  const instrumental = mode === "instrumental";
  const range = instrumental ? BGM_DURATION : VOCAL_DURATION;
  const running = !!job && job.status !== "succeeded" && job.status !== "failed";

  // 出曲模型由服务端下发；候选为空说明运营还没配，此时不让下单（而不是假装能生成）。
  React.useEffect(() => {
    let cancelled = false;
    MusicGenApi.listModels()
      .then(list => {
        if (cancelled) return;
        setModels(list);
        const def = list.find(m => m.isDefault) ?? list[0];
        if (def) setEndpointId(def.endpointId);
      })
      .catch(() => { if (!cancelled) setModels([]); })
      .finally(() => { if (!cancelled) setModelsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  // 切模式时把时长夹回合法区间，避免纯音乐带着 240s 提交被服务端打回。
  React.useEffect(() => {
    setDurationSec(d => Math.min(range.max, Math.max(range.min, d)));
  }, [mode, range.min, range.max]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const hasInput = instrumental || mode === "inspiration"
    ? prompt.trim().length > 0
    : lyrics.trim().length > 0;
  const canSubmit = hasInput && !submitting && !running && models.length > 0;

  async function start() {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const created = await MusicGenApi.createJob({
        clientRequestId: crypto.randomUUID(),
        artistId: artistId ?? undefined,
        prompt: mode === "lyrics" ? undefined : prompt.trim() || undefined,
        lyrics: mode === "lyrics" ? lyrics.trim() : undefined,
        genre: genre || undefined,
        mood: mood || undefined,
        timbre: instrumental ? undefined : timbre || undefined,
        gender: instrumental ? undefined : gender || undefined,
        instrumental,
        durationSec,
        endpointId: endpointId || undefined,
      });
      setJob(created);
      const finished = await MusicGenApi.pollUntilDone(created.id, setJob, controller.signal);
      setJob(finished);
      if (finished.status === "failed") {
        setError(finished.errorMessage ?? "创作失败，请重试。");
      } else if (finished.status === "succeeded" && finished.songId) {
        onSongCreated?.(finished.songId);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError((e as Error).message || "创作失败，请重试。");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setJob(null);
    setError(null);
  }

  const notConfigured = modelsLoaded && models.length === 0;

  return (
    <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 shrink-0 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              AI 创作工坊
            </h3>
            <p className="text-xs text-gray-500 font-light truncate">
              {artistName
                ? <>演唱者：<span className="text-cyan-400">{artistName}</span></>
                : <span className="text-cyan-400">自由创作 · 作品归属你的账号</span>}
            </p>
          </div>
        </div>
        {job && !running && (
          <Button variant="ghost" size="sm" onClick={reset} className="text-gray-400 hover:text-white text-xs">
            再创作一首
          </Button>
        )}
      </div>

      {notConfigured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-light leading-relaxed">
            音乐生成尚未开通。请联系运营在管理后台配置音乐模型后再来创作 —— 在此之前无法生成作品。
          </p>
        </div>
      )}

      {/* 创作模式 */}
      <div className="flex items-center gap-2 bg-black/30 border border-white/5 rounded-xl p-1 w-fit max-w-full overflow-x-auto">
        {COMPOSE_MODES.map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            disabled={running}
            title={m.hint}
            className={`px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition disabled:opacity-50 ${
              mode === m.id
                ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30"
                : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* 输入区 */}
      {mode === "lyrics" ? (
        <div className="space-y-2">
          <Textarea
            value={lyrics}
            onChange={e => setLyrics(e.target.value)}
            disabled={running}
            rows={8}
            placeholder={"粘贴你的歌词。可以用结构标签分段，例如：\n[verse]\n记得那一天 我们相遇在雨里\n[chorus]\n而你的名字 成了我的四季"}
            className="bg-black/30 border-white/10 resize-none font-light"
          />
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500">插入结构标签：</span>
            {LYRIC_TAGS.map(tag => (
              <button
                key={tag}
                type="button"
                disabled={running}
                onClick={() => setLyrics(v => (v ? v + "\n" + tag + "\n" : tag + "\n"))}
                className="text-[11px] px-1.5 py-0.5 rounded border border-white/10 text-gray-400 hover:text-cyan-300 hover:border-cyan-500/30 transition disabled:opacity-50"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          disabled={running}
          rows={4}
          placeholder={instrumental
            ? "描述你想要的伴奏，例如：深夜咖啡馆 · 慵懒爵士钢琴 · 适合阅读"
            : "描述你想要的歌，例如：深夜地铁 · 独自回家 · lo-fi 氛围 · 带一点释然"}
          className="bg-black/30 border-white/10 resize-none font-light"
        />
      )}

      {/* 参数 */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LabeledSelect label="曲风" value={genre} onChange={setGenre} disabled={running}
          options={GENRE_OPTIONS} placeholder="交给 AI 判断" />
        <LabeledSelect label="情绪" value={mood} onChange={setMood} disabled={running}
          options={MOOD_OPTIONS} placeholder="交给 AI 判断" />
        {!instrumental && (
          <LabeledSelect label="声线" value={gender} onChange={setGender} disabled={running}
            options={GENDER_OPTIONS} placeholder="交给 AI 判断" />
        )}
        {!instrumental && (
          <LabeledSelect label="音色" value={timbre} onChange={setTimbre} disabled={running}
            options={TIMBRE_OPTIONS} placeholder="交给 AI 判断" />
        )}
      </div>

      {/* 时长 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">时长</span>
          <span className="text-cyan-300 tabular-nums font-medium">{formatDuration(durationSec)}</span>
        </div>
        <input
          type="range"
          min={range.min}
          max={range.max}
          step={range.step}
          value={durationSec}
          disabled={running}
          onChange={e => setDurationSec(Number(e.target.value))}
          aria-label="生成时长（秒）"
          className="w-full accent-cyan-400 disabled:opacity-50"
        />
        <p className="text-[11px] text-gray-600">
          {instrumental ? `纯音乐支持 ${range.min}–${range.max} 秒` : `歌曲支持 ${range.min}–${range.max} 秒`}
          {" · "}按实际成曲时长结算积分
        </p>
      </div>

      {/* 模型选择：只有多个候选时才出现，避免给用户一个没得选的下拉 */}
      {models.length > 1 && (
        <LabeledSelect
          label="出曲模型"
          value={endpointId}
          onChange={setEndpointId}
          disabled={running}
          options={models.map(m => ({ value: m.endpointId, label: m.name }))}
          placeholder="默认模型"
          allowEmpty={false}
        />
      )}

      {/* 进度 */}
      <AnimatePresence>
        {job && running && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-3 py-3"
          >
            <div className="flex items-center gap-2 text-sm text-cyan-200">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span className="truncate">{stageLabel(job)}</span>
              <span className="ml-auto tabular-nums text-xs text-cyan-300">{job.progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
                animate={{ width: `${Math.max(3, job.progress)}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
            <p className="text-[11px] text-gray-500">
              生成通常需要 1–3 分钟，可以先去做别的，作品会自动进入你的音乐列表。
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 结果 */}
      {job?.status === "succeeded" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
            <span className="text-sm font-medium text-green-200">创作完成</span>
            <Badge className="bg-white/5 text-gray-300 border-white/10 text-[11px]">
              {formatDuration(job.actualDurationSec ?? job.durationSec)}
            </Badge>
            <Badge className="bg-white/5 text-gray-300 border-white/10 text-[11px]">
              消耗 {formatCredits(job.creditsSettled)} 积分
            </Badge>
          </div>

          {job.audioUrl && (
            // 播放的是我方存储里的成品，不是上游临时地址
            <audio controls src={job.audioUrl} className="w-full" preload="none">
              您的浏览器不支持音频播放。
            </audio>
          )}

          {job.resultLyrics && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-200 select-none">
                查看歌词
              </summary>
              <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap text-xs leading-relaxed text-gray-300 font-light">
                {job.resultLyrics}
              </pre>
            </details>
          )}

          <p className="text-[11px] text-gray-500">
            作品已存入音乐列表，可在那里改名、换封面并推进发布。
          </p>
        </motion.div>
      )}

      {/* 错误 */}
      {error && !running && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="font-light leading-relaxed break-words">{error}</p>
        </div>
      )}

      {/* 操作 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          onClick={start}
          disabled={!canSubmit}
          title={notConfigured ? "音乐生成尚未开通" : (!hasInput ? "请先描述你想创作的音乐" : undefined)}
          className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2"
        >
          {submitting || running
            ? <><Loader2 className="w-4 h-4 animate-spin" /> 创作中…</>
            : <><Music2 className="w-4 h-4" /> 开始创作</>}
        </Button>
        {job?.status === "failed" && (
          <Button variant="outline" onClick={start} disabled={!canSubmit} className="gap-2">
            <RefreshCcw className="w-4 h-4" /> 重试
          </Button>
        )}
        <span className="text-[11px] text-gray-600 inline-flex items-center gap-1">
          <Wand2 className="w-3 h-3" />
          失败不扣积分
        </span>
      </div>
    </div>
  );
}

function LabeledSelect({
  label, value, onChange, options, placeholder, disabled, allowEmpty = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
  allowEmpty?: boolean;
}) {
  const EMPTY = "__auto__";
  return (
    <div className="space-y-1 min-w-0">
      <label className="text-xs text-gray-400">{label}</label>
      <Select
        value={value === "" ? EMPTY : value}
        disabled={disabled}
        onValueChange={v => onChange(v === EMPTY ? "" : v)}
      >
        <SelectTrigger className="bg-black/30 border-white/10 text-sm">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {allowEmpty && <SelectItem value={EMPTY}>{placeholder}</SelectItem>}
          {options.map(o => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
