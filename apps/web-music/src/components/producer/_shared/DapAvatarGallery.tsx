"use client";

// ─────────────────────────────────────────────────────────────────────────────
// DapAvatarGallery.tsx — v0.60 收敛后的艺人形象画廊。
//
// 引入数字人创建的艺人（artist.dapAvatarId 非空）形象统一实时引用 AiAvatar 资产：
//   - 左：当前选中形象大图（默认 = 艺人首要展示图）+「设为首要展示图」
//   - 右：分组资产墙（定妆照与机位 / 形象变体 / 造型 / 场景图），点击切换预览
//   - Header 右侧：去 AiAvatar 渲染新形象（深链）—— 生成 / 渲染均在 AiAvatar 完成
//
// 数据来源：DapAvatarsApi（mock 下回落 mocks/dap-avatars.ts）。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Check, ExternalLink, ImageOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@ai-star-eco/ui/ui/button";
import { Badge } from "@ai-star-eco/ui/ui/badge";
import type { Artist } from "@ai-star-eco/types/artist";
import * as ArtistsApi from "@/api/artists";
import { dapAvatarDeepLink, listMyDapAvatars, type DapAvatarLite } from "@/api/dap-avatars";
import { DISPLAY_GROUPS, loadDisplayOptions, type DisplayOption } from "@/lib/dap-display-options";

interface Props {
  artist: Artist;
  /** 「设为首要展示图」成功后回调（PATCH dapDisplayRef）；缺省时隐藏该按钮（纯预览） */
  onUpdated?: (a: Artist) => void;
}

export function DapAvatarGallery({ artist, onUpdated }: Props) {
  const [avatar, setAvatar] = useState<DapAvatarLite | null>(null);
  const [options, setOptions] = useState<DisplayOption[]>([]);
  const [loading, setLoading] = useState(true);
  /** undefined = 跟随艺人当前展示图；其余为本地预览选择 */
  const [chosenRef, setChosenRef] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentRef = artist.dapDisplayRef ?? null;
  const avatarId = artist.dapAvatarId ? String(artist.dapAvatarId) : null;

  useEffect(() => {
    if (!avatarId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setChosenRef(undefined);
    listMyDapAvatars()
      .then(async (list) => {
        const target = list.find((a) => a.id === avatarId) ?? null;
        if (cancelled) return;
        setAvatar(target);
        if (!target) { setOptions([]); return; }
        const opts = await loadDisplayOptions(target);
        if (!cancelled) setOptions(opts);
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [artist.id, avatarId]);

  const selectedRef = chosenRef === undefined ? currentRef : chosenRef;
  const selected = options.find((o) => o.ref === selectedRef) ?? options[0] ?? null;
  const isCurrent = !!selected && selected.ref === currentRef;

  async function setAsDisplay() {
    if (!selected || isCurrent) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await ArtistsApi.patchArtist(artist.id, {
        dapDisplayRef: selected.ref,
      } as Partial<Artist>);
      onUpdated?.(updated);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-gray-900/70 via-gray-900/50 to-gray-900/70 h-full flex flex-col"
    >
      {/* 顶栏 */}
      <div className="flex items-start md:items-center justify-between gap-3 p-5 border-b border-white/5 flex-col md:flex-row">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-cyan-300" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
              AI 形象画廊
            </h2>
            <p className="text-[11px] text-gray-500 font-light">
              共 {options.length} 张 · 实时引用自 AiAvatar 数字人「{artist.dapAvatarName || avatar?.name || "—"}」
            </p>
          </div>
        </div>
        {avatarId && (
          <a href={dapAvatarDeepLink(avatarId, "scene")} target="_blank" rel="noreferrer" className="shrink-0">
            <Button size="sm"
              className="bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white shadow-lg shadow-cyan-500/20 gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> 去 AiAvatar 渲染新形象 <ExternalLink className="w-3 h-3" />
            </Button>
          </a>
        )}
      </div>

      {/* 主体 */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center min-h-[320px]">
          <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
        </div>
      ) : !avatar ? (
        <UnavailableState artist={artist} />
      ) : (
        <div className="p-5 flex flex-col md:flex-row gap-5 flex-1 min-h-0">
          {/* 左：大图预览 */}
          <div className="md:w-[280px] shrink-0 self-start md:sticky md:top-0">
            <div className="relative rounded-xl overflow-hidden border border-white/15 bg-gray-950/40 shadow-lg shadow-black/30">
              <div className="aspect-[3/4]">
                {selected ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={selected.url} alt={selected.label} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">暂无可用形象图</div>
                )}
              </div>
              {isCurrent && (
                <Badge className="absolute top-2.5 left-2.5 bg-cyan-500/20 text-cyan-200 border-cyan-400/40 border text-[10px]">
                  当前展示图
                </Badge>
              )}
            </div>
            <div className="mt-2.5 text-sm font-semibold text-white truncate">{selected?.label ?? "—"}</div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
              首要展示图用于艺人头像、卡片与分发物料的默认形象
            </p>
            {onUpdated && selected && !isCurrent && (
              <Button
                size="sm"
                onClick={setAsDisplay}
                disabled={saving}
                className="mt-3 w-full bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                设为首要展示图
              </Button>
            )}
            {error && (
              <div className="mt-3 text-[11px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                {error}
              </div>
            )}
          </div>

          {/* 右：分组资产墙 */}
          <div className="flex-1 min-w-0 space-y-5">
            {DISPLAY_GROUPS.map((group) => {
              const groupOpts = options.filter((o) => o.group === group);
              if (groupOpts.length === 0) return null;
              return (
                <div key={group}>
                  <div className="text-xs text-gray-400 font-semibold mb-2">
                    {group} <span className="text-gray-600">（{groupOpts.length}）</span>
                  </div>
                  <div className="grid grid-cols-3 xl:grid-cols-4 gap-2.5">
                    {groupOpts.map((o) => {
                      const active = selected?.ref === o.ref;
                      const isDisplayed = o.ref === currentRef;
                      return (
                        <button
                          key={o.ref ?? "main"}
                          onClick={() => setChosenRef(o.ref)}
                          className={`group relative text-left rounded-lg overflow-hidden border transition ${
                            active ? "border-cyan-400 ring-2 ring-cyan-400/40" : "border-white/10 hover:border-cyan-500/40"
                          }`}
                        >
                          <div className="aspect-[3/4] overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={o.url} alt={o.label} className="w-full h-full object-cover group-hover:scale-105 transition" />
                          </div>
                          {isDisplayed && (
                            <span className="absolute top-1.5 left-1.5 px-1.5 py-px rounded bg-cyan-500/85 text-[9px] text-white font-semibold">
                              展示中
                            </span>
                          )}
                          <div className="px-2 py-1.5 text-[10px] text-gray-300 truncate bg-gray-950/70">{o.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {avatarId && (
              <a
                href={dapAvatarDeepLink(avatarId, "scene")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 transition"
              >
                <Sparkles className="w-3.5 h-3.5" /> 图不够用？去 AiAvatar 渲染更多造型与场景图
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </motion.section>
  );
}

/** 引用的数字人不可用（已删除 / 回收站）时的回退视图。 */
function UnavailableState({ artist }: { artist: Artist }) {
  return (
    <div className="flex-1 py-14 flex flex-col items-center text-center px-6">
      {artist.dapDisplayImageUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={artist.dapDisplayImageUrl} alt={artist.name}
          className="w-24 aspect-[3/4] object-cover rounded-lg border border-white/10 mb-3 opacity-70" />
      ) : (
        <ImageOff className="w-8 h-8 text-gray-600 mb-3" />
      )}
      <div className="text-sm text-gray-300 mb-1">引用的数字人当前不可用</div>
      <div className="text-xs text-gray-500 font-light mb-4 max-w-sm leading-relaxed">
        该艺人引用的数字人可能已被删除或在回收站。到 AiAvatar 恢复后，这里会自动恢复展示。
      </div>
      <a href={dapAvatarDeepLink(String(artist.dapAvatarId ?? ""))} target="_blank" rel="noreferrer">
        <Button size="sm" variant="outline" className="border-white/10 gap-1.5">
          去 AiAvatar 查看 <ExternalLink className="w-3 h-3" />
        </Button>
      </a>
    </div>
  );
}
