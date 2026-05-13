"use client";

import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Sparkles, Send, Square, RefreshCcw, CheckCircle2, Bot, User,
  Clock, Gauge, Coins, Music, FileText, Palette,
} from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Textarea } from "@ai-star-eco/ui/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@ai-star-eco/ui/ui/select";
import { formatCredits } from "@/lib/format";
import type {
  GenerationStage, StreamStage, GenerationMessage, GeneratedMusicDraft,
} from "@ai-star-eco/types/generation";
import type { ThinkDepth, Song } from "@ai-star-eco/types/music";
import { STAGE_SEQUENCE, STAGE_SCRIPT, MOCK_DRAFTS } from "@/mocks/generation";
import {
  STAGE_CONFIG, STREAM_CHUNK_SIZE, STREAM_INTERVAL_MS,
  STAGE_HOLD_MS, PRE_ANALYZE_MS,
} from "@/constants/generation-ui";
import { MODEL_VERSION_OPTIONS, THINK_DEPTH_OPTIONS } from "@/constants/music-ui";
import { MusicApi } from "@/api";

interface Props {
  artistId: string;
  artistName: string;
  /** 预填 prompt（例如由外部模板点击注入）。变更时建议通过 key 重挂载。 */
  initialPrompt?: string;
  onCreated?: (song: Song) => void;
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** 秒 → "mm:ss" */
function fmtDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AIGenerationPanel({ artistId, artistName, initialPrompt, onCreated }: Props) {
  const [prompt, setPrompt] = React.useState(initialPrompt ?? "夜晚城市 · 合成器 · 带一点忧伤的期待感");
  const [modelVersion, setModelVersion] = React.useState<string>("suno-v3");
  const [thinkDepth, setThinkDepth] = React.useState<ThinkDepth>("standard");

  const [stage, setStage] = React.useState<GenerationStage>("idle");
  const [messages, setMessages] = React.useState<GenerationMessage[]>([]);
  const [draft, setDraft] = React.useState<GeneratedMusicDraft | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [savedSongId, setSavedSongId] = React.useState<string | null>(null);

  const abortRef = React.useRef(false);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  // 自动滚到底
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, stage]);

  const running = stage !== "idle" && stage !== "done" && stage !== "error";

  async function streamStage(s: StreamStage, ctx: { prompt: string; artist: string }) {
    if (abortRef.current) return;
    setStage(s);
    const id = `m-${s}-${Date.now()}`;
    const full = STAGE_SCRIPT[s]
      .map(line => line.replaceAll("{{prompt}}", ctx.prompt).replaceAll("{{artist}}", ctx.artist))
      .join("\n");
    setMessages(prev => [
      ...prev,
      { id, role: "assistant", content: "", stage: s, createdAt: new Date().toISOString() },
    ]);
    for (let i = 0; i < full.length; i += STREAM_CHUNK_SIZE) {
      if (abortRef.current) return;
      await sleep(STREAM_INTERVAL_MS);
      const snippet = full.slice(0, i + STREAM_CHUNK_SIZE);
      setMessages(prev => prev.map(m => (m.id === id ? { ...m, content: snippet } : m)));
    }
    await sleep(STAGE_HOLD_MS);
  }

  async function run() {
    if (!prompt.trim()) return;
    abortRef.current = false;
    setDraft(null);
    setSavedSongId(null);
    setMessages([{
      id: `m-user-${Date.now()}`,
      role: "user",
      content: prompt.trim(),
      createdAt: new Date().toISOString(),
    }]);
    setStage("analyzing");
    await sleep(PRE_ANALYZE_MS);

    const ctx = { prompt: prompt.trim(), artist: artistName };
    for (const s of STAGE_SEQUENCE) {
      await streamStage(s, ctx);
      if (abortRef.current) {
        setStage("idle");
        return;
      }
    }

    const picked = {
      ...MOCK_DRAFTS[Math.floor(Math.random() * MOCK_DRAFTS.length)],
      modelVersion,
      thinkDepth,
    };
    setDraft(picked);
    setStage("done");
  }

  function abort() {
    abortRef.current = true;
  }

  async function accept() {
    if (!draft) return;
    if (!artistId) {
      setMessages(prev => [...prev, {
        id: `m-err-${Date.now()}`,
        role: "assistant",
        content: "❌ 当前未选中任何签约艺人，无法入库。请先在左上切换器中选择一位艺人。",
        stage: undefined,
        createdAt: new Date().toISOString(),
      }]);
      return;
    }
    setSaving(true);
    try {
      const song = await MusicApi.createSong({
        artistId,
        title: draft.title,
        genre: draft.genre,
        duration: draft.duration,
        lyrics: draft.lyrics,
        modelVersion: draft.modelVersion,
        thinkDepth: draft.thinkDepth,
        prompt: prompt.trim(),
      });
      setSavedSongId(song.id);
      onCreated?.(song);
    } catch (err) {
      // 失败时在最后一条消息后追加错误提示
      setMessages(prev => [...prev, {
        id: `m-err-${Date.now()}`,
        role: "assistant",
        content: `❌ 入库失败：${(err as Error).message}`,
        stage: undefined,
        createdAt: new Date().toISOString(),
      }]);
    } finally {
      setSaving(false);
    }
  }

  function regenerate() {
    setDraft(null);
    setSavedSongId(null);
    void run();
  }

  function resetAll() {
    abortRef.current = true;
    setMessages([]);
    setDraft(null);
    setSavedSongId(null);
    setStage("idle");
  }

  return (
    <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              AI 创作工坊
            </h3>
            <p className="text-xs text-gray-500 font-light">
              和大模型对话，流式生成数字音乐 · 当前歌手：<span className="text-cyan-400">{artistName}</span>
            </p>
          </div>
        </div>
        {messages.length > 0 && !running && (
          <Button variant="ghost" size="sm" onClick={resetAll} className="text-gray-400 hover:text-white text-xs">
            清空会话
          </Button>
        )}
      </div>

      {/* Stage stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {STAGE_SEQUENCE.map((s, idx) => {
          const cfg = STAGE_CONFIG[s];
          const Icon = cfg.icon;
          const currentIdx = STAGE_SEQUENCE.indexOf(stage as StreamStage);
          const isActive = stage === s;
          const isDone = stage === "done" || (currentIdx >= 0 && idx < currentIdx);
          return (
            <React.Fragment key={s}>
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border transition ${
                  isActive
                    ? `${cfg.bg} ${cfg.border} ${cfg.color}`
                    : isDone
                      ? "bg-green-500/5 border-green-500/20 text-green-400"
                      : "bg-white/[0.02] border-white/5 text-gray-500"
                }`}
              >
                {isActive ? (
                  <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}>
                    <Icon className="w-3.5 h-3.5" />
                  </motion.span>
                ) : isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
                <span className="font-medium whitespace-nowrap">{cfg.label}</span>
              </div>
              {idx < STAGE_SEQUENCE.length - 1 && (
                <div className={`h-px w-5 shrink-0 ${isDone ? "bg-green-500/40" : "bg-white/10"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Chat transcript */}
      <div
        ref={scrollRef}
        className="bg-black/30 border border-white/5 rounded-lg p-4 h-[340px] overflow-y-auto space-y-3"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 text-sm font-light gap-2">
            <Bot className="w-8 h-8 text-gray-600" />
            <p>输入你想创作的主题，大模型会分阶段生成一首完整的数字音乐草案。</p>
            <p className="text-xs text-gray-600">示例：「深夜地铁 · 独自回家 · lo-fi 氛围」</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map(m => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
            >
              {m.role === "assistant" && (
                <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center ${
                  m.stage ? STAGE_CONFIG[m.stage].bg : "bg-gray-500/10"
                }`}>
                  {m.stage
                    ? React.createElement(STAGE_CONFIG[m.stage].icon, {
                        className: `w-3.5 h-3.5 ${STAGE_CONFIG[m.stage].color}`,
                      })
                    : <Bot className="w-3.5 h-3.5 text-gray-400" />}
                </div>
              )}
              <div className={`max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap font-light ${
                m.role === "user"
                  ? "bg-cyan-500/15 border border-cyan-500/20 text-cyan-100 rounded-2xl rounded-tr-sm px-4 py-2.5"
                  : "text-gray-200"
              }`}>
                {m.content}
                {running && m.role === "assistant" && m.stage === stage && (
                  <motion.span
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="inline-block w-1.5 h-3.5 align-middle ml-0.5 bg-current"
                  />
                )}
              </div>
              {m.role === "user" && (
                <div className="w-7 h-7 shrink-0 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-cyan-300" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Draft card */}
      <AnimatePresence>
        {draft && stage === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-gradient-to-br from-cyan-500/5 to-purple-500/5 border border-cyan-500/20 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs text-cyan-400 font-medium uppercase tracking-widest mb-1">AI 草案</div>
                <h4 className="text-xl font-bold">{draft.title}</h4>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                  <Badge className="bg-purple-500/15 text-purple-300 border-purple-500/20">
                    <Music className="w-3 h-3 mr-1" /> {draft.genre}
                  </Badge>
                  <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/20">
                    <Clock className="w-3 h-3 mr-1" /> {fmtDuration(draft.duration)}
                  </Badge>
                  <Badge className="bg-pink-500/15 text-pink-300 border-pink-500/20">
                    <Gauge className="w-3 h-3 mr-1" /> {draft.bpm} BPM · {draft.key}
                  </Badge>
                  <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/20">
                    <Coins className="w-3 h-3 mr-1" /> {formatCredits(draft.creditsEstimate)}
                  </Badge>
                </div>
              </div>
              {savedSongId && (
                <Badge className="bg-green-500/15 text-green-300 border-green-500/20 shrink-0">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> 已入库
                </Badge>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-3 text-xs">
              <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-gray-400 font-medium mb-2">
                  <FileText className="w-3.5 h-3.5" /> 歌词预览
                </div>
                <pre className="text-gray-200 whitespace-pre-wrap font-light leading-relaxed max-h-40 overflow-y-auto">
                  {draft.lyrics}
                </pre>
              </div>
              <div className="bg-black/30 border border-white/5 rounded-lg p-3">
                <div className="flex items-center gap-1.5 text-gray-400 font-medium mb-2">
                  <Palette className="w-3.5 h-3.5" /> 封面生成 prompt
                </div>
                <p className="text-gray-200 font-light leading-relaxed">{draft.coverPrompt}</p>
                <p className="text-[10px] text-gray-500 mt-2">
                  · 模型：{draft.modelVersion} · 深度：{draft.thinkDepth}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={accept}
                disabled={saving || !!savedSongId || !artistId}
                title={!artistId ? "请先选择一位签约艺人" : undefined}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {savedSongId ? "已入库" : saving ? "入库中..." : "采纳并入库"}
              </Button>
              <Button variant="outline" onClick={regenerate} disabled={saving} className="gap-2">
                <RefreshCcw className="w-4 h-4" /> 再来一版
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prompt bar */}
      <div className="space-y-3">
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          disabled={running}
          placeholder="描述你想创作的主题、氛围或情绪（支持多行）"
          className="min-h-[80px] bg-black/30 border-white/10 text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select value={modelVersion} onValueChange={setModelVersion} disabled={running}>
            <SelectTrigger className="h-9 w-[180px] bg-black/30 border-white/10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODEL_VERSION_OPTIONS.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={thinkDepth} onValueChange={(v) => setThinkDepth(v as ThinkDepth)} disabled={running}>
            <SelectTrigger className="h-9 w-[140px] bg-black/30 border-white/10 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THINK_DEPTH_OPTIONS.map(opt => (
                <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex-1" />
          {running ? (
            <Button onClick={abort} variant="outline" className="gap-2 border-red-500/30 text-red-300 hover:bg-red-500/10">
              <Square className="w-4 h-4" /> 停止生成
            </Button>
          ) : (
            <Button
              onClick={run}
              disabled={!prompt.trim()}
              className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2"
            >
              <Send className="w-4 h-4" />
              {stage === "done" ? "再次生成" : "开始生成"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
