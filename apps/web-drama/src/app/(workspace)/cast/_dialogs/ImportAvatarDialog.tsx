"use client";

// ─────────────────────────────────────────────────────────────────────────────
// ImportAvatarDialog — 从 AiAvatar 引入数字人（v0.60 收敛）。
// 两步：① 选数字人（我的数字人网格）② 选首要展示图（定妆照 / 造型 / 场景图）。
// 传入 existingArtist 时进入「更换展示图」模式：跳过第一步，确认走 PATCH dapDisplayRef。
// 形象引用不复制：AiAvatar 里重渲染后这里自动跟随更新。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { ArrowLeft, Check, ExternalLink, Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import type { Artist, ArtistType } from "@ai-star-eco/types/artist";
import { ApiError } from "@ai-star-eco/api-client";
import { Dialog } from "@/components/common";
import { Button } from "@/components/premium";
import { ArtistsApi, DapAvatarsApi } from "@/api";
import type { DapAvatarLite } from "@/api/dap-avatars";

interface DisplayOption {
  /** null = 跟随定妆照；"look:<id>" / "deriv:<id>" */
  ref: string | null;
  url: string;
  label: string;
  group: "定妆照" | "造型" | "场景图";
}

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
}: Props) {
  const changeMode = !!existingArtist;
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
            setError("未找到该演员引用的数字人（可能已被删除），请先到 AiAvatar 恢复");
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
  React.useEffect(() => {
    if (!open || step !== "image" || !selected) return;
    setOptionsLoading(true);
    Promise.all([
      DapAvatarsApi.listDapLooks(selected.id).catch(() => []),
      DapAvatarsApi.listDapDerivatives(selected.id).catch(() => []),
    ])
      .then(([looks, derivs]) => {
        const opts: DisplayOption[] = [];
        if (selected.imageUrl) {
          opts.push({ ref: null, url: selected.imageUrl, label: "定妆照（默认）", group: "定妆照" });
        }
        for (const l of looks) {
          if (l.imageUrl) opts.push({ ref: `look:${l.id}`, url: l.imageUrl, label: l.label || "造型", group: "造型" });
        }
        for (const d of derivs) {
          if (!DapAvatarsApi.IMAGE_DERIV_KINDS.includes(d.kind)) continue;
          const url = d.fileUrl || d.thumbUrl;
          if (url) opts.push({ ref: `deriv:${d.id}`, url, label: d.label || d.kind, group: "场景图" });
        }
        setOptions(opts);
      })
      .finally(() => setOptionsLoading(false));
  }, [open, step, selected]);

  const usable = React.useMemo(() => avatars.filter((a) => !!a.imageUrl), [avatars]);

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      if (changeMode && existingArtist) {
        const updated = await ArtistsApi.patchArtist(existingArtist.id, {
          dapDisplayRef: chosenRef,
        } as Partial<Artist>);
        toast.success("展示图已更新");
        onUpdated?.(updated);
      } else {
        const artist = await ArtistsApi.importAvatarAsArtist({
          dapAvatarId: selected.id,
          type: defaultType,
          name: stageName.trim() || undefined,
          dapDisplayRef: chosenRef,
        });
        toast.success(`已引入「${artist.name}」`);
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
      width={720}
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
          {changeMode ? "更换展示图" : step === "avatar" ? "从 AiAvatar 引入数字人" : "选择首要展示图"}
        </span>
      }
      description={
        step === "avatar"
          ? "演员形象统一在 AiAvatar 创建与渲染，这里只做引入（引用不复制，形象自动跟随更新）。"
          : "选一张图作为该演员在本应用的首要展示；图不够用可去 AiAvatar 渲染更多场景图。"
      }
      footer={
        <>
          <Button variant="ghost" size="md" onClick={() => onOpenChange(false)}>取消</Button>
          {step === "image" && (
            <Button variant="primary" size="md" onClick={submit} disabled={submitting || !selected}>
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {changeMode ? "保存展示图" : "引入为演员"}
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
              <Loader2 size={15} className="animate-spin" /> 正在加载我的数字人...
            </div>
          )}
          {!avatarsLoading && usable.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "36px 0 24px" }}>
              <Users size={28} style={{ color: "var(--accent)", marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>还没有可引入的数字人</div>
              <p style={{ fontSize: 12.5, color: "var(--fg-2)", maxWidth: 360, margin: "0 auto 16px", lineHeight: 1.6 }}>
                数字人统一在 AiAvatar 创建（真人复刻或 AI 生成），完成定妆照后即可在这里引入为演员。
              </p>
              <a href={DapAvatarsApi.AIAVATAR_URL} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <Button variant="primary" size="md">
                  <Sparkles size={14} /> 去 AiAvatar 创建数字人 <ExternalLink size={12} />
                </Button>
              </a>
            </div>
          )}
          {!avatarsLoading && usable.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {usable.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelected(a); setChosenRef(null); setStep("image"); }}
                  style={{ ...tile, border: "1px solid var(--line-2)" }}
                >
                  <div style={{ aspectRatio: "3 / 4", overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageUrl!} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                  <div style={{ padding: "7px 9px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: "var(--fg-3)" }}>{a.id}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {step === "image" && selected && (
        <>
          {optionsLoading && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "48px 0", color: "var(--fg-2)", fontSize: 13 }}>
              <Loader2 size={15} className="animate-spin" /> 正在加载形象资产...
            </div>
          )}
          {!optionsLoading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {(["定妆照", "造型", "场景图"] as const).map((group) => {
                const groupOpts = options.filter((o) => o.group === group);
                if (groupOpts.length === 0) return null;
                return (
                  <div key={group}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-2)", marginBottom: 8 }}>{group}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
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
                                  position: "absolute", top: 6, right: 6, width: 18, height: 18, borderRadius: 999,
                                  background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
                                }}
                              >
                                <Check size={11} color="#fff" />
                              </span>
                            )}
                            <div style={{ padding: "5px 8px", fontSize: 10, color: "var(--fg-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
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
                <Sparkles size={13} /> 图不够用？去 AiAvatar 为「{selected.name}」渲染场景图 <ExternalLink size={11} />
              </a>
              {!changeMode && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-2)", marginBottom: 6 }}>
                    艺名（可选，默认使用数字人名称「{selected.name}」）
                  </div>
                  <input
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    maxLength={32}
                    placeholder={selected.name}
                    style={{
                      width: 280,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--line-2)",
                      borderRadius: "var(--radius-md)",
                      padding: "8px 12px",
                      color: "var(--fg-0)",
                      fontSize: 13,
                      outline: "none",
                      fontFamily: "var(--font-sans)",
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
