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
  activeArtist: Artist;
  /** 兼容老接口（从 OverviewPage 跳转时传入），当前 StudioPage 内部已按真实歌曲渲染，忽略此字段。 */
  selectedTrackId?: number | null;
  onClearSelection?: () => void;
}

type StudioTab = "ai" | "library";

export function StudioPage({ lang, activeArtist }: Props) {
  const zh = lang === "zh";
  const typeConf = ARTIST_TYPE_CONFIG[activeArtist.type];
  const workshopName = zh ? typeConf.workshop.zh : typeConf.workshop.en;
  const typeLabel = zh ? ARTIST_TYPE_LABELS[activeArtist.type].zh : ARTIST_TYPE_LABELS[activeArtist.type].en;
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
        setSongs(list.filter(s => s.artistId === activeArtist.id));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeArtist.id]);

  function handleCreated(song: Song) {
    setSongs(prev => [song, ...prev]);
  }

  function applyTemplate(tmpl: string) {
    setInitialPrompt(`${tmpl} · ${typeLabel} · 中文`);
    setPanelKey(k => k + 1);
    setTab("ai");
  }

  const tabs: { key: StudioTab; label: string; icon: React.ElementType; hint: string }[] = [
    { key: "ai", label: "AI 音乐创作", icon: Wand2, hint: "与大模型对话并生成新曲" },
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
            {zh ? `${typeLabel}专属创作工坊 · 与大模型对话生成数字内容` : `${typeLabel} Exclusive Workshop`}
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
            artistId={activeArtist.id}
            artistName={activeArtist.name}
            initialPrompt={initialPrompt}
            onCreated={handleCreated}
          />

          {/* Templates */}
          <div className="bg-gray-900/50 border border-white/5 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                  创作模板
                </h3>
                <p className="text-xs text-gray-500 font-light mt-1">
                  点击任一模板，其关键词会注入上方对话框作为新一轮生成的起点。
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
          artistName={activeArtist.name}
          artistAvatar={activeArtist.avatar}
        />
      )}

      {/* Footer hint */}
      <p className="text-xs text-gray-600 font-light text-center">
        提示：进入「音乐工坊」可查看歌曲详情、修改歌词 / 封面、推进发布状态并跳转到「全网分发」。
      </p>
    </div>
  );
}
