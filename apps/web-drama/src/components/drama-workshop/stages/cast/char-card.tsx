"use client";

// 角色卡 — 设计真源:screens-project.jsx `CharCard`。
// 关键角色:大数字人封面(已绑) / 待绑占位(未绑) + 三张参考图槽;龙套:文字外观。
import * as React from "react";
import { ImagePlus, Layers, RefreshCw, Sparkles, User } from "lucide-react";
import { Avatar, GenFramePlaceholder, Thumb } from "@/components/drama-ui";
import { CreditButton } from "@/components/drama-ui";
import { AVATAR_THEMES, type CharacterDef } from "@/mocks/drama-workshop";

interface CharCardProps {
  c: CharacterDef;
  delay?: number;
  onBind: () => void;
  onToggleRole: () => void;
  /** 上传真人参考图（→ 素材库）。 */
  onUploadRef?: (file: File) => void;
  /** AI 生成角色定妆参考图（锁脸用）。 */
  onGenRef?: () => void;
  /** 点开参考图看大图。 */
  onViewRef?: () => void;
  /** 上传中 / 生成中。 */
  uploading?: boolean;
  /** C-2：一键生成 正/侧/全身 三视图参考图集。 */
  onGenSheet?: () => void;
  /** 三视图单次消耗（用于确认弹窗展示；真实计费后台）。 */
  sheetCost?: number;
  /** 三视图生成中。 */
  sheetBusy?: boolean;
  /** 点开某张多角度参考图看大图。 */
  onViewImage?: (url: string) => void;
}

const ANGLE_LABEL: Record<string, string> = { front: "正面", side: "侧面", full: "全身", expression: "表情", env: "空景" };

export function CharCard({ c, delay = 0, onBind, onToggleRole, onUploadRef, onGenRef, onViewRef, uploading, onGenSheet, sheetCost = 6, sheetBusy, onViewImage }: CharCardProps) {
  const isKey = c.role === "key";
  const theme = AVATAR_THEMES[c.avatar] ?? AVATAR_THEMES.default;
  const refImages = c.refImages ?? [];

  return (
    <div
      className="card col fade-up"
      style={{
        padding: 0,
        overflow: "hidden",
        animationDelay: delay + "ms",
      }}
    >
      {/* 形象区:关键角色显数字人分身;龙套:无 */}
      {isKey ? (
        <div style={{ position: "relative" }}>
          {c.bound ? (
            <Thumb
              from={theme.from}
              to={theme.to}
              src={c.avatarImage || undefined}
              ratio="16/9"
              radius={0}
              style={{ width: "100%" }}
            >
              {/* 真图上压一层暗渐变，保证白字可读 */}
              {c.avatarImage && (
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(0,0,0,.55), rgba(0,0,0,.15))" }} />
              )}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                }}
              >
                {c.avatarImage ? (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      flex: "none",
                      background: `center/cover no-repeat url(${c.avatarImage})`,
                      boxShadow: "0 0 0 3px var(--surface), 0 0 0 5px var(--accent)",
                    }}
                  />
                ) : (
                  <Avatar theme={c.avatar} size={64} ring />
                )}
                <div style={{ color: "#fff" }}>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 18,
                      textShadow: "0 1px 6px rgba(0,0,0,.3)",
                    }}
                  >
                    {c.name}
                  </div>
                  <div className="row gap-2" style={{ fontSize: 11.5, marginTop: 4 }}>
                    <span className="thumb-label">
                      <Sparkles
                        size={10}
                        fill="#fff"
                        strokeWidth={0}
                        style={{ verticalAlign: -1, marginRight: 3 }}
                      />
                      数字人已绑
                    </span>
                    <span className="thumb-label num">参考图 ×{c.refCount ?? 3}</span>
                  </div>
                </div>
              </div>
            </Thumb>
          ) : (
            <div
              className="col center"
              style={{
                aspectRatio: "16/9",
                background: "var(--surface-2)",
                gap: 10,
                borderBottom: "1px dashed var(--line)",
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: "50%",
                  background: "var(--surface)",
                  display: "grid",
                  placeItems: "center",
                  color: "var(--ink-3)",
                  boxShadow: "var(--shadow-sm)",
                }}
              >
                <User size={24} />
              </div>
              <button
                type="button"
                className="btn btn-grad btn-sm"
                onClick={onBind}
              >
                <Sparkles size={14} fill="currentColor" strokeWidth={0} /> 绑定数字人分身
              </button>
            </div>
          )}
        </div>
      ) : null}

      <div className="col gap-2" style={{ padding: 16 }}>
        <div className="row gap-2">
          {!isKey && (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: "var(--surface-2)",
                display: "grid",
                placeItems: "center",
                color: "var(--ink-3)",
                flex: "none",
              }}
            >
              <User size={17} />
            </div>
          )}
          <div className="grow">
            <div style={{ fontWeight: 800, fontSize: 15 }}>{c.name}</div>
            <div className="faint" style={{ fontSize: 11.5 }}>{c.cast}</div>
          </div>
          <button
            type="button"
            className="chip"
            onClick={onToggleRole}
            style={{
              height: 26,
              fontSize: 11.5,
              background: isKey ? "var(--accent-soft)" : "var(--surface-2)",
              color: isKey ? "var(--accent)" : "var(--ink-2)",
            }}
          >
            {isKey ? "关键角色" : "龙套"}
          </button>
        </div>
        <div className="muted" style={{ fontSize: 12.5, lineHeight: 1.55 }}>{c.desc}</div>
        {/* 真人参考图：上传真实剧照锁形象（→ 素材库）；点开看大图 */}
        <div className="col gap-2" style={{ marginTop: 2 }}>
          <div className="faint" style={{ fontSize: 11, fontWeight: 700 }}>真人参考图 · 上传真实剧照锁定形象</div>
          {c.refUrl ? (
            <div className="row gap-2" style={{ alignItems: "center" }}>
              <button
                type="button"
                onClick={onViewRef}
                title="点开看大图"
                style={{ width: 56, height: 72, borderRadius: 10, overflow: "hidden", border: "none", padding: 0, cursor: "zoom-in", flex: "none", background: "var(--surface-2)" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.refUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </button>
              <label className="btn btn-line btn-sm" style={{ cursor: uploading ? "default" : "pointer" }}>
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (f) onUploadRef?.(f);
                  }}
                />
                {uploading ? "上传中…" : (<><RefreshCw size={13} /> 重新上传</>)}
              </label>
              {onGenRef && (
                <button type="button" className="btn btn-line btn-sm btn-icon" title="AI 重新生成定妆图" disabled={uploading} onClick={onGenRef} style={{ flex: "none" }}>
                  <Sparkles size={13} />
                </button>
              )}
              {isKey && c.bound && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={onBind} style={{ flex: "none" }}>
                  换形象
                </button>
              )}
            </div>
          ) : (
            <div className="row gap-2">
              {onGenRef && (
                <button
                  type="button"
                  className="btn btn-line btn-sm grow"
                  style={{ justifyContent: "center" }}
                  disabled={uploading}
                  onClick={onGenRef}
                >
                  {uploading ? "生成中…" : (<><Sparkles size={14} /> AI 定妆图</>)}
                </button>
              )}
              <label
                className="row center grow"
                style={{ height: 34, borderRadius: 10, border: "1.5px dashed var(--line)", background: "var(--surface-2)", color: "var(--ink-3)", gap: 6, cursor: uploading ? "default" : "pointer", fontSize: 12, fontWeight: 600 }}
              >
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (f) onUploadRef?.(f);
                  }}
                />
                {uploading ? "上传中…" : (<><ImagePlus size={15} /> 上传</>)}
              </label>
            </div>
          )}
        </div>

        {/* C-2 多角度参考图集（正/侧/全身）：跨镜锁形象的一致性地基 */}
        {onGenSheet && (
          <div className="col gap-2" style={{ marginTop: 2 }}>
            <div className="row gap-2" style={{ alignItems: "center" }}>
              <span className="faint" style={{ fontSize: 11, fontWeight: 700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                多角度参考图 · 正侧全身锁形象
              </span>
              <span className="grow" />
              <CreditButton
                cost={sheetCost}
                onConfirm={onGenSheet}
                confirmTitle="生成多角度参考图"
                confirmBody="AI 会为该角色生成 正面 / 侧面 / 全身 三张参考图，用于跨镜锁定形象。"
                className="btn btn-line btn-sm"
                disabled={sheetBusy}
                title="生成 正/侧/全身 三视图"
              >
                <Layers size={13} /> {sheetBusy ? "生成中…" : refImages.length > 0 ? "重新生成" : "一键三视图"}
              </CreditButton>
            </div>
            {sheetBusy ? (
              <div className="row gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ width: 56, height: 74, flex: "none" }}>
                    <GenFramePlaceholder width="100%" height="100%" radius={9} />
                  </div>
                ))}
              </div>
            ) : refImages.length > 0 ? (
              <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                {refImages.map((r, i) => (
                  <div key={r.cdnKey || i} className="col" style={{ gap: 3, alignItems: "center", width: 56 }}>
                    <button
                      type="button"
                      onClick={() => r.url && onViewImage?.(r.url)}
                      title={`${(r.angle && ANGLE_LABEL[r.angle]) || r.label || "参考图"} · 点开看大图`}
                      style={{ width: 56, height: 74, borderRadius: 9, overflow: "hidden", border: "1px solid var(--line)", padding: 0, cursor: r.url ? "zoom-in" : "default", background: "var(--surface-2)", flex: "none" }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.url && <img src={r.url} alt={r.label || r.angle || "参考图"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
                    </button>
                    <span className="faint" style={{ fontSize: 10, maxWidth: 56, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.label || (r.angle && ANGLE_LABEL[r.angle]) || "参考图"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="faint" style={{ fontSize: 11 }}>还没有多角度参考图，点「一键三视图」生成正/侧/全身。</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
