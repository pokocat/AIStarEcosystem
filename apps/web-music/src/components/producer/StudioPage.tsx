"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Sparkles, ArrowRight, Wand2, ListMusic } from "lucide-react";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import type { Lang } from "../../translations";
import {
  type Artist, ARTIST_TYPE_CONFIG, ARTIST_TYPE_LABELS,
} from "./ArtistTypes";
import type { Song } from "@ai-star-eco/types/music";
import { MusicApi } from "@/api";
import { AIGenerationPanel } from "./AIGenerationPanel";
import { MusicLibrary } from "./MusicLibrary";

interface Props {
  lang: Lang;
  /** 选中的签约艺人。可空：没有艺人也能进创作工坊自由创作。 */
  activeArtist: Artist | null;
  /** 兼容老接口（从 OverviewPage 跳转时传入），当前 StudioPage 内部已按真实歌曲渲染，忽略此字段。 */
  selectedTrackId?: number | null;
  onClearSelection?: () => void;
}

type StudioTab = "ai" | "library";

export function StudioPage({ lang, activeArtist }: Props) {
  const zh = lang === "zh";
  const typeConf = ARTIST_TYPE_CONFIG[activeArtist?.type ?? "singer"];
  // 无艺人时沿用侧栏同名的「音乐工坊」，不另造「音乐创作工坊」这个第三种叫法
  const workshopName = activeArtist
    ? (zh ? typeConf.workshop.zh : typeConf.workshop.en)
    : "音乐工坊";
  const typeLabel = activeArtist
    ? (zh ? ARTIST_TYPE_LABELS[activeArtist.type].zh : ARTIST_TYPE_LABELS[activeArtist.type].en)
    : "自由创作";
  const templates = zh ? typeConf.templates.zh : typeConf.templates.en;

  const [tab, setTab] = React.useState<StudioTab>("ai");
  const [songs, setSongs] = React.useState<Song[]>([]);
  const [loading, setLoading] = React.useState(true);

  // 模板注入 prompt 时通过 key 重挂载 panel
  const [initialPrompt, setInitialPrompt] = React.useState<string | undefined>(undefined);
  const [panelKey, setPanelKey] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    MusicApi.listSongs()
      .then(list => {
        if (cancelled) return;
        // 选中艺人 → 只看该艺人的歌；自由创作 → 看当前账号全部作品。
        setSongs(activeArtist ? list.filter(s => s.artistId === activeArtist.id) : list);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeArtist?.id]);

  /**
   * 生成成功后重新拉列表 —— 歌曲是服务端在任务完成时建的，
   * 前端自己拼一条塞进去会和真实数据（真实时长、结算积分、音频地址）对不上。
   */
  function handleSongCreated() {
    MusicApi.listSongs()
      .then(list => setSongs(activeArtist ? list.filter(s => s.artistId === activeArtist.id) : list))
      .catch(() => { /* 列表刷新失败不影响已完成的作品，用户切 tab 会重拉 */ });
  }

  function applyTemplate(tmpl: string) {
    setInitialPrompt(`${tmpl} · ${typeLabel} · 中文`);
    setPanelKey(k => k + 1);
    setTab("ai");
  }

  const tabs: { key: StudioTab; label: string; icon: React.ElementType; hint: string }[] = [
    { key: "ai", label: "AI 音乐创作", icon: Wand2, hint: "描述想要的音乐，AI 谱曲并演唱" },
    { key: "library", label: "音乐列表", icon: ListMusic, hint: `${songs.length} 首可试听` },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
            {workshopName}
          </h1>
          <p className="text-gray-400 font-light mt-1 flex items-center gap-2">
            <span className="text-lg">{typeConf.icon}</span>
            {activeArtist
              ? (zh ? `${typeLabel}专属创作工坊 · 描述想要的音乐，AI 谱曲并演唱` : `${typeLabel} Exclusive Workshop`)
              : "无需签约艺人，直接创作音乐 · 作品归属你的账号"}
          </p>
        </div>
        <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/20">
          <Sparkles className="w-3 h-3 mr-1" /> AI Playground
        </Badge>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 bg-gray-900/60 border border-white/5 rounded-xl p-1 w-fit">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-gradient-to-r from-cyan-500/20 to-purple-500/20 text-white border border-cyan-500/30"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
              }`}
              title={t.hint}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === "ai" && (
        <div className="space-y-6">
          <AIGenerationPanel
            key={panelKey}
            artistId={activeArtist?.id}
            artistName={activeArtist?.name}
            initialPrompt={initialPrompt}
            onSongCreated={handleSongCreated}
          />

          {/* Templates */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                  创作模板
                </h3>
                {/* 面板已从对话改成表单，这里不能再说「对话框」；「注入」也是内部说法 */}
                <p className="text-xs text-gray-500 font-light mt-1">
                  点击任一模板，会把它的关键词填进上方的创作描述里，你可以再改。
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {templates.map((tmpl, i) => (
                <motion.button
                  key={tmpl + i}
                  onClick={() => applyTemplate(tmpl)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-white/5 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition text-left group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-7 h-7 rounded-md ${typeConf.bgColor} flex items-center justify-center shrink-0`}>
                      <span className="text-sm">{typeConf.icon}</span>
                    </div>
                    <span className="text-sm font-medium truncate">{tmpl}</span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-500 group-hover:text-cyan-400 transition shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "library" && (
        <MusicLibrary
          songs={songs}
          loading={loading}
          artistName={activeArtist?.name}
          artistAvatar={activeArtist?.avatar}
        />
      )}

      {/*
        原文案让用户「进入音乐工坊」——而这里就是音乐工坊；还指向了尚在建设中的全网分发。
        改成指向本页真实可达的去处。
      */}
      <p className="text-xs text-gray-600 font-light text-center">
        提示：切到「音乐列表」可试听已完成的作品，并修改标题、曲风与歌词。
      </p>
    </div>
  );
}
