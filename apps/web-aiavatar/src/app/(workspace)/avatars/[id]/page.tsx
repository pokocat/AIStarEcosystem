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
import { getAvatarDetail, forkAvatar, revertToVersion } from "@/api/ai-avatar";
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
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="line" icon={Icons.copy} onClick={async () => { const f = await forkAvatar(avatar.id); toast("已另存为新数字人草稿", { icon: "⎘" }); router.push(`/avatars/${f.id}`); }}>另存为新数字人</Btn>
          <Btn variant="line" icon={Icons.download} onClick={() => toast(`资产包下载中 · ${avatar.id}.zip`)}>下载资产包</Btn>
          {avatar.status !== "archived" && continueStep && <Btn variant="pri" icon={Icons.sliders} onClick={() => router.push(`/avatars/${avatar.id}/${continueStep}`)}>继续编辑</Btn>}
          <IconBtn icon={Icons.more} onClick={() => toast("更多操作：归档 / 转移 / 删除", { icon: "⋯" })} />
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
