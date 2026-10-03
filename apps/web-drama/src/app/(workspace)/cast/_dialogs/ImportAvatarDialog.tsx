"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ImportAvatarDialog — 从 AiAvatar 导入数字人（v0.60 收敛；v0.197 界面叫法：导入 / 封面图）。
// 两步：① 选数字人（我的数字人网格）② 选封面图（定妆照 / 造型 / 场景图）。
// 传入 existingArtist 时进入「换封面图」模式：跳过第一步，确认走 PATCH dapDisplayRef。
// 形象引用不复制：AiAvatar 里重渲染后这里自动跟随更新。
// 窄屏：选图步骤的「大图预览 | 图片墙」在 ≤720 改上下排（样式见 styles/pages/market.css 的 .mk-avatar-*）。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { ArrowLeft, Check, ExternalLink, Loader2, RefreshCw, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import type { Artist, ArtistType } from "@ai-star-eco/types/artist";
import { ApiError } from "@ai-star-eco/api-client";
import { Dialog } from "@/components/common";
import { Button } from "@/components/premium";
import { ArtistsApi, DapAvatarsApi } from "@/api";
import type { DapAvatarLite } from "@/api/dap-avatars";

interface DisplayOption {
  /** null = 跟随定妆照；"look:<id>" / "deriv:<id>" / "variant:<idx>" / "shot:<name>" */
  ref: string | null;
  url: string;
  label: string;
  group: DisplayGroup;
}

type DisplayGroup = "定妆照和多角度" | "备选图" | "造型" | "场景图";
const DISPLAY_GROUPS: DisplayGroup[] = ["定妆照和多角度", "备选图", "造型", "场景图"];
const SHOT_LABELS: Record<string, string> = { "front-half": "正面半身", right: "右侧脸", left: "左侧脸" };

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** 引入成功回调（引入模式） */
  onImported?: (a: Artist) => void;
  /** 更换展示图模式：传入已引用数字人的演员 */
  existingArtist?: Artist | null;
  /** 展示图更新成功回调（更换模式） */
  onUpdated?: (a: Artist) => void;
  /** 引入时创建的艺人类型（drama 端默认 actor） */
  defaultType?: ArtistType;
  /** 已引入的数字人 id 列表（同类型重复引入会被拦，网格里置灰标记） */
  importedAvatarIds?: string[];
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : String(e);
}

export function ImportAvatarDialog({
  open,
  onOpenChange,
  onImported,
  existingArtist,
  onUpdated,
  defaultType = "actor",
  importedAvatarIds,
}: Props) {
  const changeMode = !!existingArtist;
  const importedSet = React.useMemo(() => new Set(importedAvatarIds ?? []), [importedAvatarIds]);
  const [step, setStep] = React.useState<"avatar" | "image">("avatar");
  const [avatars, setAvatars] = React.useState<DapAvatarLite[]>([]);
  const [avatarsLoading, setAvatarsLoading] = React.useState(false);
  const [selected, setSelected] = React.useState<DapAvatarLite | null>(null);
  const [options, setOptions] = React.useState<DisplayOption[]>([]);
  const [optionsLoading, setOptionsLoading] = React.useState(false);
  const [chosenRef, setChosenRef] = React.useState<string | null>(null);
  const [stageName, setStageName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // 空态里「我做好了，刷新」：去 AiAvatar 新建完回来，不用关掉弹窗重开
  const [reloadTick, setReloadTick] = React.useState(0);

  // 打开时重置 + 拉数字人列表
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setChosenRef(changeMode ? (existingArtist?.dapDisplayRef ?? null) : null);
    setStageName("");
    setSelected(null);
    setOptions([]);
    setStep("avatar");
    setAvatarsLoading(true);
    DapAvatarsApi.listMyDapAvatars()
      .then((list) => {
        setAvatars(list);
        if (changeMode && existingArtist?.dapAvatarId) {
          const target = list.find((a) => a.id === existingArtist.dapAvatarId) ?? null;
          if (!target) {
            setError("找不到这位演员对应的数字人，可能已经在 AiAvatar 里删掉了");
            return;
          }
          setSelected(target);
          setStep("image");
        }
      })
      .catch((e) => setError(errMsg(e)))
      .finally(() => setAvatarsLoading(false));
  }, [open, changeMode, existingArtist, reloadTick]);

  // 进入选图步骤时拉造型 + 场景图
  React.useEffect(() => {
    if (!open || step !== "image" || !selected) return;
    setOptionsLoading(true);
    Promise.all([
      DapAvatarsApi.listDapLooks(selected.id).catch(() => []),
      DapAvatarsApi.listDapDerivatives(selected.id).catch(() => []),
    ])
      .then(([looks, derivs]) => {
        const opts: DisplayOption[] = [];
        const seen = new Set<string>();
        const push = (o: DisplayOption) => {
          if (o.url && !seen.has(o.url)) { seen.add(o.url); opts.push(o); }
        };
        if (selected.imageUrl) {
          push({ ref: null, url: selected.imageUrl, label: "定妆照（默认）", group: "定妆照和多角度" });
        }
        for (const [k, url] of Object.entries(selected.shotImages ?? {})) {
          push({ ref: `shot:${k}`, url, label: SHOT_LABELS[k] ?? "其他角度", group: "定妆照和多角度" });
        }
        (selected.variantImages ?? []).forEach((url, i) => {
          push({ ref: `variant:${i}`, url, label: `备选图 ${i + 1}`, group: "备选图" });
        });
        for (const l of looks) {
          if (l.imageUrl) push({ ref: `look:${l.id}`, url: l.imageUrl, label: l.label || "造型", group: "造型" });
        }
        for (const d of derivs) {
          if (!DapAvatarsApi.IMAGE_DERIV_KINDS.includes(d.kind)) continue;
          const url = d.fileUrl || d.thumbUrl;
          if (url) push({ ref: `deriv:${d.id}`, url, label: d.label || "场景图", group: "场景图" });
        }
        setOptions(opts);
      })
      .finally(() => setOptionsLoading(false));
  }, [open, step, selected]);

  const usable = React.useMemo(() => avatars.filter((a) => !!a.imageUrl), [avatars]);
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
        toast.success("封面已更换");
        onUpdated?.(updated);
      } else {
        const artist = await ArtistsApi.importAvatarAsArtist({
          dapAvatarId: selected.id,
          type: defaultType,
          name: stageName.trim() || undefined,
          dapDisplayRef: chosenRef,
        });
        toast.success(`已导入「${artist.name}」`);
        onImported?.(artist);
      }
      onOpenChange(false);
    } catch (e) {
      const msg = errMsg(e);
      toast.error(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const tile: React.CSSProperties = {
    position: "relative",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    cursor: "pointer",
    background: "rgba(255,255,255,0.03)",
    padding: 0,
    textAlign: "left",
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={980}
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {step === "image" && !changeMode && (
            <button
              onClick={() => { setStep("avatar"); setChosenRef(null); }}
              aria-label="返回选择数字人"
              style={{ background: "none", border: "none", color: "var(--fg-2)", cursor: "pointer", display: "inline-flex" }}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          {changeMode ? "换封面图" : step === "avatar" ? "从 AiAvatar 导入数字人" : "选一张封面图"}
        </span>
      }
      description={
        step === "avatar"
          ? "数字人在 AiAvatar（数字人平台）里做。导入后这里用的是同一个数字人，你在 AiAvatar 里改了，这边也会跟着变。"
          : "选一张图当这位演员的封面。想要更多图，可以去 AiAvatar 做。"
      }
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>取消</Button>
          {step === "image" && (
            <Button variant="primary" size="md" onClick={submit} disabled={submitting || !selected}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {changeMode ? "保存封面" : "导入为演员"}
            </Button>
          )}
        </>
      }
    >
      {error && (
        <div
          style={{
            marginBottom: 14,
            fontSize: 12,
            color: "var(--danger, #f87171)",
            background: "rgba(248,113,113,0.08)",
            border: "1px solid rgba(248,113,113,0.25)",
            borderRadius: "var(--radius-md)",
            padding: "8px 12px",
          }}
        >
          {error}
        </div>
      )}

      {step === "avatar" && (
        <>
          {avatarsLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "48px 0", color: "var(--fg-2)", fontSize: 13 }}>
              <Loader2 size={15} className="animate-spin" /> 正在加载我的数字人…
            </div>
          )}
          {!avatarsLoading && usable.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "36px 0 24px" }}>
              <Users size={28} style={{ color: "var(--accent)", marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>还没有能导入的数字人</div>
              <p style={{ fontSize: 12.5, color: "var(--fg-2)", maxWidth: 360, margin: "0 auto 16px", lineHeight: 1.6 }}>
                先去 AiAvatar 做一个数字人（可以用真人照片复刻，也可以让 AI 生成）。定妆照做好后，回这里导入。
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <a href={DapAvatarsApi.AIAVATAR_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                  <Button variant="primary" size="md">
                    <Sparkles size={14} /> 去 AiAvatar 创建数字人 <ExternalLink size={12} />
                  </Button>
                </a>
                <Button variant="ghost" size="md" onClick={() => setReloadTick((t) => t + 1)}>
                  <RefreshCw size={14} /> 我做好了，刷新
                </Button>
              </div>
            </div>
          )}
          {!avatarsLoading && usable.length > 0 && (
            <div className="mk-avatar-grid">
              {usable.map((a) => {
                const imported = importedSet.has(a.id);
                return (
                  <button
                    key={a.id}
                    disabled={imported}
                    onClick={() => { setSelected(a); setChosenRef(null); setStep("image"); }}
                    style={{
                      ...tile,
                      border: "1px solid var(--line-2)",
                      opacity: imported ? 0.45 : 1,
                      cursor: imported ? "not-allowed" : "pointer",
                    }}
                  >
                    <div style={{ aspectRatio: "3 / 4", overflow: "hidden" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={a.imageUrl!} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                    {imported && (
                      <span
                        style={{
                          position: "absolute", top: 8, right: 8, padding: "2px 6px", borderRadius: 4,
                          background: "rgba(0,0,0,0.7)", fontSize: 10, color: "var(--accent)",
                          border: "1px solid color-mix(in srgb, var(--accent) 35%, transparent)",
                        }}
                      >
                        已导入
                      </span>
                    )}
                    <div style={{ padding: "7px 9px" }}>
                      <div title={a.name} style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                      <div style={{ fontSize: 10, color: "var(--fg-3)" }}>{imported ? "已导入为演员" : "选这个"}</div>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "48px 0", color: "var(--fg-2)", fontSize: 13 }}>
              <Loader2 size={15} className="animate-spin" /> 正在加载图片…
            </div>
          )}
          {!optionsLoading && (
            <div className="mk-avatar-pick">
              {/* 左（窄屏在上）：当前选择大图预览 */}
              <div className="mk-avatar-pick-preview">
                <div style={{ borderRadius: "var(--radius-lg)", overflow: "hidden", border: "1px solid var(--line-2)", background: "rgba(255,255,255,0.03)", boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
                  <div style={{ aspectRatio: "3 / 4" }}>
                    {current ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={current.url} alt={current.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-3)", fontSize: 12 }}>还没有能用的图</div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: "var(--fg-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {current ? current.label : "—"}
                </div>
                <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2, lineHeight: 1.5 }}>
                  演员卡片上会显示这张，之后在详情页能换
                </div>
                {!changeMode && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-2)", marginBottom: 6 }}>
                      名字（不填就用「{selected.name}」）
                    </div>
                    <input
                      value={stageName}
                      onChange={(e) => setStageName(e.target.value)}
                      maxLength={32}
                      placeholder={selected.name}
                      style={{
                        width: "100%",
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid var(--line-2)",
                        borderRadius: "var(--radius-md)",
                        padding: "8px 12px",
                        color: "var(--fg-0)",
                        fontSize: 13,
                        outline: "none",
                        fontFamily: "var(--font-sans)",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 右：全部形象资产墙 */}
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                {DISPLAY_GROUPS.map((group) => {
                  const groupOpts = options.filter((o) => o.group === group);
                  if (groupOpts.length === 0) return null;
                  return (
                    <div key={group}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-1)", marginBottom: 8 }}>
                        {group} <span style={{ color: "var(--fg-3)" }}>（{groupOpts.length}）</span>
                      </div>
                      <div className="mk-avatar-opts">
                        {groupOpts.map((o) => {
                          const active = chosenRef === o.ref;
                          return (
                            <button
                              key={o.ref ?? "main"}
                              onClick={() => setChosenRef(o.ref)}
                              style={{
                                ...tile,
                                border: active
                                  ? "1px solid color-mix(in srgb, var(--accent) 75%, transparent)"
                                  : "1px solid var(--line-2)",
                                boxShadow: active ? "0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent)" : undefined,
                              }}
                            >
                              <div style={{ aspectRatio: "3 / 4", overflow: "hidden" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={o.url} alt={o.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                              {active && (
                                <span
                                  style={{
                                    position: "absolute", top: 8, right: 8, width: 20, height: 20, borderRadius: 999,
                                    background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
                                  }}
                                >
                                  <Check size={12} color="#fff" />
                                </span>
                              )}
                              <div style={{ padding: "6px 9px", fontSize: 11, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {o.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                <a
                  href={DapAvatarsApi.dapAvatarDeepLink(selected.id, "scene")}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
                >
                  <Sparkles size={13} style={{ flex: "none" }} /> 想要更多造型或场景图？去 AiAvatar 给「{selected.name}」做 <ExternalLink size={11} style={{ flex: "none" }} />
                </a>
              </div>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
