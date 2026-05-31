"use client";
// ============================================================
// 资产详情 — 图集 / 3D / 视频 / 版本时间线 / 授权信息 Tab + 右信息栏 + 头部操作。
// （从原型 screens-detail.jsx 移植。）
// ============================================================
import * as React from "react";
import { useRouter, useParams } from "next/navigation";
import type { AiAvatarDetail } from "@ai-star-eco/types/ai-avatar";
import { Btn, IconBtn, Portrait, Seg, Tag, StatusPill } from "@/components/ui/primitives";
import { SourceBadge } from "@/components/common/source-badge";
import { VideoPlayer, Viewer3D } from "@/components/common/media";
import { Icons } from "@/components/ui/icons";
import { useApi } from "@/lib/hooks";
import { archiveAvatar, getAvatarDetail, forkAvatar, revertToVersion } from "@/api/ai-avatar";
import { modeLabel, styleHue, STATUS_NEXT_STEP, COMPOSITIONS } from "@/constants/aiavatar-ui";
import { hueFor } from "@/lib/hue";
import { fmtDate, fmtDateTime, fmtBytes } from "@/lib/format";
import { toast } from "@/components/ui/toast";

export default function AvatarDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { data: detail, loading, reload } = useApi(() => getAvatarDetail(id), [id]);
  const [tab, setTab] = React.useState("images");
  const [active, setActive] = React.useState(0);
  const [moreOpen, setMoreOpen] = React.useState(false);

  if (loading && !detail) return <Center>载入资产…</Center>;
  if (!detail) return <Center tone="err">资产不存在</Center>;

  const { avatar } = detail;
  const hue = styleHue(avatar.styleCategory);
  const isReal = avatar.mode === "real_clone";

  const shots = (() => {
    const withShot = detail.assets.filter((a) => a.standardShot);
    if (withShot.length) return withShot.slice(0, 6).map((a, i) => ({ id: a.id, name: COMPOSITIONS[i]?.name ?? "标准图", ratio: COMPOSITIONS[i]?.ratio ?? "3:4", src: a.fileUrl || avatar.coverUrl, engine: a.engine, mode: a.providerMode }));
    return COMPOSITIONS.map((c) => ({ id: c.id, name: c.name, ratio: c.ratio, src: avatar.coverUrl, engine: null, mode: null }));
  })();

  const tabs = [
    { value: "images", label: "标准图集", icon: Icons.image },
    ...(avatar.has3d ? [{ value: "3d", label: "3D 模型", icon: Icons.cube }] : []),
    ...(avatar.hasVideo ? [{ value: "video", label: "渲染视频", icon: Icons.film }] : []),
    { value: "versions", label: "版本记录", icon: Icons.history },
    ...(isReal ? [{ value: "auth", label: "授权信息", icon: Icons.shield }] : []),
  ];

  const continueStep = STATUS_NEXT_STEP[avatar.status];
  const cur = shots[active] ?? shots[0];

  return (
    <div className="fade-up">
      {/* 顶栏 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 36px", borderBottom: "1px solid var(--line)", background: "var(--bg-1)", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <IconBtn icon={Icons.back} onClick={() => router.push("/library")} />
          <Portrait hue={hue} src={avatar.coverUrl} ratio="1/1" label="" style={{ width: 44, height: 44, borderRadius: 10 }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ margin: 0, fontSize: 21, fontWeight: 600 }}>{avatar.name}</h1>
              <span className="mono" style={{ fontSize: 12, color: "var(--ink-2)" }}>{avatar.id}</span>
              <StatusPill status={avatar.status} />
            </div>
            <div style={{ display: "flex", gap: 7, marginTop: 6, flexWrap: "wrap" }}>
              <Tag>{modeLabel(avatar.mode)}</Tag>
              {avatar.styleCategory && <Tag>{avatar.styleCategory}</Tag>}
              {avatar.tags.map((t) => <Tag key={t}># {t}</Tag>)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, position: "relative" }}>
          <Btn variant="line" icon={Icons.copy} onClick={async () => { const f = await forkAvatar(avatar.id); toast("已另存为新数字人草稿", { icon: "⎘" }); router.push(`/avatars/${f.id}`); }}>另存为新数字人</Btn>
          <Btn variant="line" icon={Icons.download} onClick={() => downloadAssetManifest(detail)}>下载资产包</Btn>
          {avatar.status !== "archived" && continueStep && <Btn variant="pri" icon={Icons.sliders} onClick={() => router.push(`/avatars/${avatar.id}/${continueStep}`)}>继续编辑</Btn>}
          <IconBtn icon={Icons.more} active={moreOpen} onClick={() => setMoreOpen((v) => !v)} />
          {moreOpen && (
            <MoreActions
              detail={detail}
              currentAssetUrl={cur?.src}
              onClose={() => setMoreOpen(false)}
              onFork={async () => {
                const f = await forkAvatar(avatar.id);
                toast("已另存为新数字人草稿", { icon: "⎘" });
                router.push(`/avatars/${f.id}`);
              }}
              onArchive={async () => {
                await archiveAvatar(avatar.id);
                await reload();
                toast("已归档入库");
              }}
            />
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 0, minHeight: "calc(100vh - 132px)" }}>
        {/* 主区 */}
        <div style={{ padding: "24px 36px 48px" }}>
          <div style={{ marginBottom: 22 }}><Seg value={tab} onChange={setTab} options={tabs} /></div>

          {tab === "images" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 28 }}>
              <div><Portrait hue={hue} src={cur?.src} ratio="3/4" label={cur?.name} sub={(cur?.ratio ?? "") + " · 1080P"} style={{ maxHeight: 540 }} /></div>
              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 14 }}>STANDARD SET · 4+2</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {shots.map((c, i) => (
                    <div key={c.id} onClick={() => setActive(i)} style={{ position: "relative" }}>
                      <Portrait hue={hue} src={c.src} ratio="3/4" label={c.name} selected={active === i} style={{ cursor: "pointer" }} />
                      {c.mode && <div style={{ position: "absolute", bottom: 6, right: 6 }}><SourceBadge mode={c.mode} engine={c.engine} /></div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tab === "3d" && (
            <div style={{ maxWidth: 620 }}>
              <Viewer3D hue={200} precision="high" ratio="16/10" posterSrc={avatar.coverUrl} />
              <div style={{ display: "flex", gap: 24, margin: "16px 0", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-1)" }}>
                {["面数 · 高模 · 86k", "格式 · GLB / FBX", "兼容 · 主流渲染引擎"].map((t) => <span key={t}>{t}</span>)}
              </div>
              <Btn variant="line" size="sm" icon={Icons.download} onClick={() => toast("已下载 model.glb")}>下载 3D 模型</Btn>
            </div>
          )}

          {tab === "video" && (
            <div style={{ maxWidth: 620 }}>
              <VideoPlayer hue={hue} dur={20} scene="直播间" posterSrc={avatar.coverUrl} />
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                <Btn variant="line" size="sm" icon={Icons.download} onClick={() => toast("已下载 render.mp4")}>下载视频</Btn>
                <Btn variant="ghost" size="sm" icon={Icons.retry} onClick={() => toast("已提交重渲染任务", { icon: "⚡" })}>重新渲染</Btn>
              </div>
            </div>
          )}

          {tab === "versions" && <div style={{ maxWidth: 680 }}><VersionTimeline detail={detail} onRevert={async (vid) => { await revertToVersion(avatar.id, vid); reload(); toast("已回溯到该版本", { icon: "⤺" }); }} /></div>}

          {tab === "auth" && <AuthInfo detail={detail} />}
        </div>

        {/* 右信息栏 */}
        <div style={{ borderLeft: "1px solid var(--line)", background: "var(--bg-1)", padding: 24 }}>
          <InfoBlock title="资产信息" rows={[["资产 ID", avatar.id], ["创建模式", modeLabel(avatar.mode)], ["基础风格", avatar.styleCategory ?? "—"], ["创建时间", fmtDate(avatar.createdAt)], ["创建者", "陈墨"]]} />
          <InfoBlock title="产出物" rows={[["标准图集", `${detail.assets.filter((a) => a.standardShot).length || 0} 张`], ["3D 模型", avatar.has3d ? "高精度版" : "未生成"], ["渲染视频", avatar.hasVideo ? "20s · 1080P" : "未生成"]]} />
          <div style={{ marginTop: 8 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 12 }}>原始素材</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {detail.sourceMaterials.filter((m) => m.kind === "photo").slice(0, 3).map((m) => (
                <div key={m.id} style={{ position: "relative", width: 52 }}>
                  <Portrait hue={hue} src={m.assetUrl} ratio="1/1" label="" style={{ width: 52, borderRadius: 7 }} />
                  <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(10,11,14,0.5)", borderRadius: 7 }}><Icons.lock size={14} style={{ color: "var(--ink-1)" }} /></span>
                </div>
              ))}
              <div style={{ width: 52, aspectRatio: "1", borderRadius: 7, border: "1px dashed var(--line-3)", display: "grid", placeItems: "center", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 10 }}>{isReal ? "加密" : "文案"}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoreActions({
  detail,
  currentAssetUrl,
  onClose,
  onFork,
  onArchive,
}: {
  detail: AiAvatarDetail;
  currentAssetUrl?: string | null;
  onClose: () => void;
  onFork: () => Promise<void>;
  onArchive: () => Promise<void>;
}) {
  const { avatar } = detail;
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void> | void) => {
    try {
      setBusy(key);
      await fn();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "操作失败", { icon: "!", tone: "var(--err)" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 80,
        right: 0,
        top: "calc(100% + 8px)",
        width: 246,
        padding: 8,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--line-2)",
        background: "var(--bg-1)",
        boxShadow: "0 22px 60px rgba(0,0,0,.42)",
      }}
      onMouseLeave={onClose}
    >
      <MenuItem icon={Icons.copy} label="复制详情链接" busy={busy === "copy-link"} onClick={() => run("copy-link", async () => {
        await copyText(window.location.href);
        toast("已复制详情链接");
      })} />
      <MenuItem icon={Icons.tag} label="复制资产 ID" busy={busy === "copy-id"} onClick={() => run("copy-id", async () => {
        await copyText(avatar.id);
        toast("已复制资产 ID");
      })} />
      <MenuItem icon={Icons.download} label="下载当前预览图" disabled={!currentAssetUrl} busy={busy === "download-image"} onClick={() => run("download-image", () => {
        if (!currentAssetUrl) throw new Error("当前没有可下载预览图");
        downloadUrl(currentAssetUrl, `${safeFilename(avatar.name)}-${avatar.id.slice(0, 8)}.png`);
      })} />
      <MenuItem icon={Icons.doc} label="下载资产清单" busy={busy === "manifest"} onClick={() => run("manifest", () => downloadAssetManifest(detail))} />
      <Divider />
      <MenuItem icon={Icons.copy} label="另存为新数字人" busy={busy === "fork"} onClick={() => run("fork", onFork)} />
      <MenuItem icon={Icons.folder} label={avatar.status === "archived" ? "已归档" : "归档入库"} disabled={avatar.status === "archived"} busy={busy === "archive"} onClick={() => run("archive", onArchive)} />
      <Divider />
      <div style={{ padding: "8px 9px", fontSize: 11.5, lineHeight: 1.5, color: "var(--ink-3)" }}>
        转移所有权 / 彻底删除需要后端审计接口，当前不展示假按钮。
      </div>
    </div>
  );
}

function MenuItem({
  icon: I,
  label,
  onClick,
  disabled,
  busy,
}: {
  icon: typeof Icons[keyof typeof Icons];
  label: string;
  onClick: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "9px 10px",
        border: "none",
        borderRadius: 7,
        background: "transparent",
        color: disabled ? "var(--ink-3)" : "var(--ink-1)",
        cursor: disabled || busy ? "not-allowed" : "pointer",
        fontSize: 13,
        textAlign: "left",
        fontFamily: "var(--font-ui)",
        opacity: busy ? 0.65 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled && !busy) {
          e.currentTarget.style.background = "var(--bg-2)";
          e.currentTarget.style.color = "var(--ink-0)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = disabled ? "var(--ink-3)" : "var(--ink-1)";
      }}
    >
      <I size={15} />
      <span>{busy ? "处理中..." : label}</span>
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--line)", margin: "6px 4px" }} />;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

function downloadAssetManifest(detail: AiAvatarDetail) {
  const payload = {
    exportedAt: new Date().toISOString(),
    avatar: detail.avatar,
    assets: detail.assets.map((a) => ({
      id: a.id,
      kind: a.kind,
      standardShot: a.standardShot,
      fileUrl: absoluteUrl(a.fileUrl),
      thumbnailUrl: a.thumbnailUrl ? absoluteUrl(a.thumbnailUrl) : null,
      mimeType: a.mimeType,
      width: a.width,
      height: a.height,
      fileSize: a.fileSize,
      engine: a.engine,
      providerMode: a.providerMode,
    })),
    versions: detail.versions,
    licenses: detail.licenses,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, `${safeFilename(detail.avatar.name)}-${detail.avatar.id.slice(0, 8)}-assets.json`);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("已下载资产清单 JSON");
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function absoluteUrl(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  return new URL(url, window.location.origin).toString();
}

function safeFilename(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "_").slice(0, 48) || "aiavatar";
}

function InfoBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-2)", letterSpacing: "0.1em", marginBottom: 12 }}>{title}</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--line)", fontSize: 13 }}>
          <span style={{ color: "var(--ink-2)" }}>{k}</span>
          <span style={{ color: "var(--ink-0)", fontWeight: 500 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function VersionTimeline({ detail, onRevert }: { detail: AiAvatarDetail; onRevert: (vid: string) => void }) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{ position: "absolute", left: 19, top: 8, bottom: 8, width: 1, background: "var(--line-2)" }} />
      {detail.versions.map((v, i) => (
        <div key={v.id} style={{ display: "flex", gap: 16, padding: "10px 0", position: "relative" }}>
          <div style={{ width: 40, display: "grid", placeItems: "center", flexShrink: 0, zIndex: 1 }}>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: i === 0 ? "var(--accent)" : "var(--bg-3)", border: "2px solid " + (i === 0 ? "var(--accent)" : "var(--line-3)"), boxShadow: i === 0 ? "0 0 0 4px var(--accent-soft)" : "none" }} />
          </div>
          <div style={{ flex: 1, padding: "12px 16px", background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--r-md)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{v.label}{v.preferred && <span style={{ marginLeft: 8 }}><Tag on>偏好</Tag></span>}</span>
              {v.sourceStatus && <StatusPill status={v.sourceStatus} />}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 12, color: "var(--ink-2)" }}>
              <span>{v.note}</span>
              <span className="mono">{fmtDateTime(v.createdAt)} · {v.author}</span>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn size="sm" variant="ghost" icon={Icons.eye} onClick={() => toast(`预览版本 ${v.label}`, { icon: "◉" })}>预览</Btn>
              {i !== 0 && <Btn size="sm" variant="ghost" icon={Icons.retry} onClick={() => onRevert(v.id)}>回溯到此版</Btn>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AuthInfo({ detail }: { detail: AiAvatarDetail }) {
  const lic = detail.licenses[0];
  return (
    <div style={{ maxWidth: 620 }}>
      <div style={{ padding: 24, background: "var(--bg-1)", border: "1px solid var(--accent-line)", borderRadius: "var(--r-lg)", boxShadow: "0 0 0 1px var(--accent-soft)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <span style={{ color: "var(--accent)" }}><Icons.shield size={26} /></span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>电子肖像授权</div>
            <div className="mono" style={{ fontSize: 11, color: lic?.status === "active" ? "var(--ok)" : "var(--err)" }}>● {lic ? (lic.status === "active" ? "已签署 · 有效" : lic.status) : "未签署"}</div>
          </div>
          {lic && <span style={{ marginLeft: "auto" }}><Btn size="sm" variant="line" icon={Icons.download} onClick={() => toast("已下载授权凭证 PDF")}>下载凭证</Btn></span>}
        </div>
        {lic ? (
          <>
            <InfoBlock title="授权详情" rows={[["被授权方", lic.subjectName ?? "—"], ["授权范围", lic.scope === "commercial" ? "商用" : "非商用"], ["使用期限", lic.validTo ? `至 ${fmtDate(lic.validTo)}` : "永久"], ["平台范围", lic.platforms.join(" / ") || "全平台"], ["签署时间", fmtDate(lic.signedAt)], ["绑定素材", `${lic.boundAssetIds.length} 张真人照片（加密）`]]} />
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: 12, borderRadius: "var(--r-md)", background: "var(--ok-soft)", border: "1px solid rgba(86,214,160,0.25)", fontSize: 12.5, color: "var(--ok)" }}>
              <Icons.lock size={15} />原始照片加密存储，仅用于本次形象生成，不对外泄露。
            </div>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>该资产尚未签署电子肖像授权。</div>
        )}
      </div>
    </div>
  );
}

function Center({ children, tone }: { children: React.ReactNode; tone?: "err" }) {
  return <div style={{ display: "grid", placeItems: "center", padding: "120px 0", color: tone === "err" ? "var(--err)" : "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>{children}</div>;
}
