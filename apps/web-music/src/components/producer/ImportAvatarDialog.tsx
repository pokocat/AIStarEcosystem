"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ImportAvatarDialog — 从 AiAvatar 引入数字人（v0.60 收敛）。
// 两步：① 选数字人（我的数字人网格）② 选首要展示图（定妆照 / 造型 / 场景图）。
// 传入 existingArtist 时进入「更换展示图」模式：跳过第一步，确认走 PATCH dapDisplayRef。
// 形象引用不复制：AiAvatar 里重渲染后这里自动跟随更新。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Loader2, Sparkles, UserPlus, Users } from "lucide-react";
import type { Artist, ArtistType } from "@ai-star-eco/types/artist";
import { Button } from "@ai-star-eco/ui/ui/button";
import { ApiError } from "@ai-star-eco/api-client";
import * as ArtistsApi from "@/api/artists";
import {
  AIAVATAR_URL,
  dapAvatarDeepLink,
  listMyDapAvatars,
  type DapAvatarLite,
} from "@/api/dap-avatars";
import {
  DISPLAY_GROUPS,
  loadDisplayOptions,
  type DisplayOption,
} from "@/lib/dap-display-options";

interface ImportAvatarDialogProps {
  open: boolean;
  onClose: () => void;
  /** 引入成功回调（引入模式） */
  onImported?: (artist: Artist) => void;
  /** 更换展示图模式：传入已引用数字人的艺人 */
  existingArtist?: Artist | null;
  /** 展示图更新成功回调（更换模式） */
  onUpdated?: (artist: Artist) => void;
  /** 引入时创建的艺人类型（music 端 singer / drama 端 actor） */
  defaultType?: ArtistType;
  /** 已引入的数字人 id 列表（同类型重复引入会被拦，网格里置灰标记） */
  importedAvatarIds?: string[];
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return `${e.message}（${e.code}）`;
  return e instanceof Error ? e.message : String(e);
}

export function ImportAvatarDialog({
  open,
  onClose,
  onImported,
  existingArtist,
  onUpdated,
  defaultType = "singer",
  importedAvatarIds,
}: ImportAvatarDialogProps) {
  const importedSet = useMemo(() => new Set(importedAvatarIds ?? []), [importedAvatarIds]);
  const changeMode = !!existingArtist;
  const [step, setStep] = useState<"avatar" | "image">("avatar");
  const [avatars, setAvatars] = useState<DapAvatarLite[]>([]);
  const [avatarsLoading, setAvatarsLoading] = useState(false);
  const [selected, setSelected] = useState<DapAvatarLite | null>(null);
  const [options, setOptions] = useState<DisplayOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [chosenRef, setChosenRef] = useState<string | null>(null);
  const [stageName, setStageName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 打开时重置 + 拉数字人列表
  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setChosenRef(changeMode ? (existingArtist?.dapDisplayRef ?? null) : null);
    setStageName("");
    setSelected(null);
    setOptions([]);
    setStep("avatar");
    setAvatarsLoading(true);
    listMyDapAvatars()
      .then((list) => {
        setAvatars(list);
        if (changeMode && existingArtist?.dapAvatarId) {
          const target = list.find((a) => a.id === existingArtist.dapAvatarId) ?? null;
          if (!target) {
            setError("未找到该艺人引用的数字人（可能已被删除），请先到 AiAvatar 恢复");
            return;
          }
          setSelected(target);
          setStep("image");
        }
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setAvatarsLoading(false));
  }, [open, changeMode, existingArtist]);

  // 进入选图步骤时拉造型 + 场景图
  useEffect(() => {
    if (!open || step !== "image" || !selected) return;
    setOptionsLoading(true);
    loadDisplayOptions(selected)
      .then(setOptions)
      .finally(() => setOptionsLoading(false));
  }, [open, step, selected]);

  const usable = useMemo(() => avatars.filter((a) => !!a.imageUrl), [avatars]);
  const current = options.find((o) => o.ref === chosenRef) ?? options[0] ?? null;

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      if (changeMode && existingArtist) {
        const updated = await ArtistsApi.patchArtist(existingArtist.id, {
          dapDisplayRef: chosenRef,
        } as Partial<Artist>);
        onUpdated?.(updated);
      } else {
        const artist = await ArtistsApi.importAvatarAsArtist({
          dapAvatarId: selected.id,
          type: defaultType,
          name: stageName.trim() || undefined,
          dapDisplayRef: chosenRef,
        });
        onImported?.(artist);
      }
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={(e) => { e.stopPropagation(); onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative bg-gray-900 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[88vh] overflow-hidden flex flex-col"
      >
        {/* 头部 */}
        <div className="px-6 pt-5 pb-4 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
              {step === "image" && !changeMode && (
                <button
                  onClick={() => { setStep("avatar"); setChosenRef(null); }}
                  className="text-gray-400 hover:text-white transition"
                  aria-label="返回选择数字人"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              {changeMode
                ? "更换展示图"
                : step === "avatar" ? "从 AiAvatar 引入数字人" : "选择首要展示图"}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {step === "avatar"
                ? "艺人形象统一在 AiAvatar 创建与渲染，这里只做引入（引用不复制，形象自动跟随更新）"
                : "选一张图作为该艺人在本应用的首要展示；图不够用可去 AiAvatar 渲染更多场景图"}
            </p>
          </div>
        </div>

        {/* 主体 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {error && (
            <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {step === "avatar" && (
            <>
              {avatarsLoading && (
                <div className="flex items-center justify-center gap-2 py-14 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> 正在加载我的数字人...
                </div>
              )}
              {!avatarsLoading && usable.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-cyan-300" />
                  </div>
                  <div className="text-sm font-semibold mb-1.5">还没有可引入的数字人</div>
                  <p className="text-xs text-gray-500 max-w-sm mb-4 leading-relaxed">
                    数字人统一在 AiAvatar 创建（真人复刻或 AI 生成），完成定妆照后即可在这里引入为艺人。
                  </p>
                  <a href={AIAVATAR_URL} target="_blank" rel="noreferrer">
                    <Button className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2">
                      <Sparkles className="w-4 h-4" /> 去 AiAvatar 创建数字人 <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </a>
                </div>
              )}
              {!avatarsLoading && usable.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {usable.map((a) => {
                    const imported = importedSet.has(a.id);
                    return (
                      <button
                        key={a.id}
                        disabled={imported}
                        onClick={() => { setSelected(a); setChosenRef(null); setStep("image"); }}
                        className={`group relative text-left rounded-xl overflow-hidden border bg-gray-950/40 transition ${
                          imported
                            ? "border-white/5 opacity-50 cursor-not-allowed"
                            : "border-white/10 hover:border-cyan-500/50"
                        }`}
                      >
                        <div className="aspect-[3/4] overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.imageUrl!} alt={a.name} className={`w-full h-full object-cover transition ${imported ? "" : "group-hover:scale-105"}`} />
                        </div>
                        {imported && (
                          <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-emerald-300 border border-emerald-500/30">
                            已引入
                          </span>
                        )}
                        <div className="px-2.5 py-2">
                          <div className="text-xs font-semibold truncate">{a.name}</div>
                          <div className="text-[10px] text-gray-500 truncate">{imported ? "已引入为艺人" : a.id}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {step === "image" && selected && (
            <>
              {optionsLoading && (
                <div className="flex items-center justify-center gap-2 py-14 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> 正在加载形象资产...
                </div>
              )}
              {!optionsLoading && (
                <div className="flex flex-col md:flex-row gap-5">
                  {/* 左：当前选择大图预览 */}
                  <div className="md:w-[300px] shrink-0 self-start md:sticky md:top-0">
                    <div className="rounded-xl overflow-hidden border border-white/15 bg-gray-950/40 shadow-lg shadow-black/30">
                      <div className="aspect-[3/4]">
                        {current ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={current.url} alt={current.label} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs">暂无可用形象图</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2.5 text-sm font-semibold text-white truncate">
                      {current ? current.label : "—"}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                      将作为该艺人在本应用的首要展示图；可随时在详情里更换
                    </p>
                    {!changeMode && (
                      <div className="mt-4">
                        <label className="block text-[11px] text-gray-500 font-semibold mb-1.5">
                          艺名（默认「{selected.name}」）
                        </label>
                        <input
                          value={stageName}
                          onChange={(e) => setStageName(e.target.value)}
                          maxLength={32}
                          placeholder={selected.name}
                          className="w-full bg-gray-950/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-cyan-500/40 focus:outline-none transition"
                        />
                      </div>
                    )}
                  </div>

                  {/* 右：全部形象资产墙 */}
                  <div className="flex-1 min-w-0 space-y-5">
                    {DISPLAY_GROUPS.map((group) => {
                      const groupOpts = options.filter((o) => o.group === group);
                      if (groupOpts.length === 0) return null;
                      return (
                        <div key={group}>
                          <div className="text-xs text-gray-400 font-semibold mb-2">
                            {group} <span className="text-gray-600">（{groupOpts.length}）</span>
                          </div>
                          <div className="grid grid-cols-3 xl:grid-cols-4 gap-3">
                            {groupOpts.map((o) => {
                              const active = chosenRef === o.ref;
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
                                  {active && (
                                    <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-cyan-500 flex items-center justify-center shadow">
                                      <Check className="w-3.5 h-3.5 text-white" />
                                    </span>
                                  )}
                                  <div className="px-2.5 py-2 text-[11px] text-gray-300 truncate bg-gray-950/70">{o.label}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    <a
                      href={dapAvatarDeepLink(selected.id, "scene")}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 transition"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> 图不够用？去 AiAvatar 为「{selected.name}」渲染更多造型与场景图
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* 底部 */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-3">
          <span className="text-[11px] text-gray-600">
            {step === "image" && selected ? `数字人：${selected.name} · ${selected.id}` : `共 ${usable.length} 个可引入`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} className="border-white/10">取消</Button>
            {step === "image" && (
              <Button
                onClick={submit}
                disabled={submitting || !selected}
                className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:opacity-90 gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {changeMode ? "保存展示图" : "引入为艺人"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
