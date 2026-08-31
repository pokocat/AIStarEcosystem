"use client";
// ============================================================
// 资产名片（M1 · 动态杂志版，设计文档 §1.5）：角色主页，不是资料表单。
//   上：巨型拉丁名做背景层 + 主视觉（有循环视频就播视频，否则定妆图）+ 资料表
//   中：「换一个样子看看」——动作 / 表情 / 视角 / 声音 / 换装，点了换主视觉；
//       消费的都是已有衍生物（运镜短视频 / 表情图集 / 标准图集 / 换装变体）
//   下：授权证书、还差几项、被用在哪
// 数据全部来自既有端点，缺什么就显示缺什么，不编造（设计文档 §3.3）。
// ============================================================
import React, { use as usePromise, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AvatarApi, ComposeApi, DATA, LicenseApi } from "@/proto/api";
import type { Avatar, AvatarReference, Composition, License } from "@/proto/data";
import { useRequireAuth } from "@/components/hub/auth";
import { settled, studioHref, useHubData } from "@/components/hub/data";
import { AssetPortrait, Badge, Card, EmptyState, HubScreen, ListRow, LoadingBlock, NavBar, SectionHeader } from "@/components/hub/ui";

const APP_LABEL: Record<string, string> = { music: "音乐", drama: "短剧" };
const VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|$)/i;

interface Deriv {
  id: string;
  key: string;
  idx: number;
  label?: string | null;
  fileUrl?: string | null;
  thumbUrl?: string | null;
}

/** 主视觉：一段可播的片子，或一张图。 */
interface Hero {
  kind: "video" | "image" | "none";
  url?: string | null;
  poster?: string | null;
  label: string;
}

/** 背景巨型字：取名字里的拉丁部分，退到 codename。 */
function bigName(c: Avatar): string {
  const hasWord = (t: string) => /[A-Za-z0-9]/.test(t);
  const latin = (c.name || "").replace(/[^ -ɏ]/g, "").trim();
  const codename = (c.codename || "").replace(/-/g, " ").trim();
  const base = hasWord(latin) ? latin : hasWord(codename) ? codename : "";
  return (base || "ASSET").toUpperCase().slice(0, 12).trim();
}

function bigNameSize(text: string): number {
  const n = Math.max(text.length, 3);
  if (n <= 5) return 74;
  if (n <= 7) return 62;
  if (n <= 9) return 50;
  return 40;
}

/** 还差几项：标准图 / 衍生 / 声音 / 人设语，四类槽位。 */
function gaps(c: Avatar): { done: number; total: number; items: { text: string; href: string }[] } {
  const items: { text: string; href: string }[] = [];
  let done = 0;
  const shotDone = DATA.SHOTS.filter((s) => c.shotImages?.[s.key]).length;
  if (shotDone >= DATA.SHOTS.length) done += 1;
  else
    items.push({
      text: `补齐标准图：还差 ${DATA.SHOTS.length - shotDone} 张，补完正面 / 侧面 / 全身出图会是同一张脸`,
      href: studioHref(`#/avatar/${c.id}/looks`),
    });
  // 按真正缺的那一类给文案，不再一律说"补服装"
  const derivGapCopy: Record<string, string> = {
    atlas: "补多角度图集：转到侧面还是同一张脸",
    expr: "补一组表情：出片时不会从头到尾一个表情",
    scene: "补几张场景图：换背景不用每次重新生成",
    ward: "补一套换装：换场景时衣服不会变来变去",
    d3: "补 3D 模型：可以换任意角度重新出图",
    video: "补一段运镜视频：名片首图就能动起来",
  };
  const derivMissing = DATA.DERIVS.filter((d) => c.deriv?.[d.key] !== "done");
  if (derivMissing.length === 0) done += 1;
  else
    items.push({
      text: derivGapCopy[derivMissing[0].key] || `补齐${derivMissing[0].name}`,
      href: studioHref(`#/avatar/${c.id}/${derivMissing[0].key}`),
    });
  if (c.voiceName) done += 1;
  else items.push({ text: "绑一个声音：视频里就用这个声线说话", href: studioHref(`#/avatar/${c.id}/voice`) });
  if (c.def?.设定语) done += 1;
  else items.push({ text: "写两句人设：AI 写台词时知道这个角色该怎么说话", href: studioHref(`#/avatar/${c.id}`) });
  return { done, total: 4, items };
}

export default function AssetCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const authState = useRequireAuth();
  const ready = authState === "ok";

  const avatar = useHubData<Avatar | null>(() => AvatarApi.get(id), null, [id], ready);
  const derivs = useHubData<Deriv[]>(() => AvatarApi.derivatives(id), [], [id], ready);
  const refs = useHubData<AvatarReference[]>(() => AvatarApi.references(id), [], [id], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [id], ready);
  const compositions = useHubData<Composition[]>(() => ComposeApi.list(), [], [id], ready);

  const [picked, setPicked] = useState<string | null>(null);
  const [tab, setTab] = useState<string>("");
  // 只有真的播起来才点亮「循环播放中」；播不了就退回封面（review #4）
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);

  // 换资产时清掉上一个的选择，避免跨资产状态污染（review #3）
  useEffect(() => {
    setPicked(null);
    setTab("");
    setPlayingUrl(null);
    setBrokenUrl(null);
  }, [id]);

  const c = avatar.data;

  const byKey = useMemo(() => {
    const m: Record<string, Deriv[]> = {};
    for (const d of derivs.data || []) (m[d.key] ||= []).push(d);
    return m;
  }, [derivs.data]);

  // 视角这一组来自标准图集（有 URL 的才算），不走衍生物
  const shotItems: Deriv[] = useMemo(
    () =>
      !c
        ? []
        : DATA.SHOTS.filter((s) => c.shotImages?.[s.key]).map((s, i) => ({
            id: `${c.id}-shot-${s.key}`,
            key: "shot",
            idx: i,
            label: s.name,
            fileUrl: c.shotImages?.[s.key],
            thumbUrl: c.shotImages?.[s.key],
          })),
    [c],
  );

  const groups = useMemo(
    () =>
      [
        { key: "video", label: "动作", items: byKey.video || [] },
        { key: "expr", label: "表情", items: byKey.expr || [] },
        { key: "shot", label: "视角", items: [...shotItems, ...(byKey.atlas || [])] },
        { key: "ward", label: "换装", items: byKey.ward || [] },
      ].filter((g) => g.items.length > 0),
    [byKey, shotItems],
  );

  const activeTab = tab || groups[0]?.key || "";
  const activeItems = groups.find((g) => g.key === activeTab)?.items || [];

  const hero: Hero = useMemo(() => {
    const all = [...(byKey.video || []), ...(byKey.expr || []), ...(byKey.ward || []), ...(byKey.atlas || []), ...shotItems];
    const chosen = picked ? all.find((d) => d.id === picked) : null;
    const fallbackVideo = (byKey.video || []).find((d) => d.fileUrl && VIDEO_RE.test(d.fileUrl));
    const src = chosen || fallbackVideo || null;
    if (src?.fileUrl && VIDEO_RE.test(src.fileUrl) && src.fileUrl !== brokenUrl) {
      return { kind: "video", url: src.fileUrl, poster: src.thumbUrl, label: src.label || "循环播放" };
    }
    const still = src?.thumbUrl || src?.fileUrl || c?.imageUrl || null;
    return still ? { kind: "image", url: still, label: src?.label || "定妆图" } : { kind: "none", label: "还没有形象" };
  }, [picked, byKey, shotItems, c, brokenUrl]);

  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  if (avatar.loading && !c) {
    return (
      <HubScreen>
        <NavBar back="/assets" title="资产名片" />
        <LoadingBlock />
      </HubScreen>
    );
  }
  if (!c || !c.id) {
    return (
      <HubScreen>
        <NavBar back="/assets" title="资产名片" />
        <Card style={{ margin: "12px 16px 0" }}>
          <EmptyState text={avatar.error || "没有找到这个资产"} actionHref="/assets" actionLabel="回资产货架" />
        </Card>
      </HubScreen>
    );
  }

  const licenseKnown = settled(licenses);
  const usageKnown = settled(refs) && settled(compositions);
  const license = licenses.data.find((l) => l.char === c.id) || null;
  const usedIn = [
    ...refs.data.map((r) => ({ key: `ref-${r.app}-${r.ipId}`, tag: APP_LABEL[r.app] || r.app, title: `艺人「${r.ipName}」的形象`, when: (r.importedAt || "").slice(0, 10) })),
    ...compositions.data.filter((cp) => cp.avatarId === c.id).map((cp) => ({ key: `cp-${cp.id}`, tag: "合成", title: "合成出片", when: cp.created })),
  ];
  const g = gaps(c);
  const big = bigName(c);
  const status = DATA.STATUS[c.status];

  return (
    <HubScreen>
      {/* ── 主视觉舞台 ─────────────────────────────── */}
      <div style={{ position: "relative", height: 524, background: "linear-gradient(178deg, #D6E3EC 0%, #DEE9F0 46%, var(--canvas) 100%)", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 4 }}>
          <Link href="/assets" aria-label="返回" style={{ width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,.86)", display: "grid", placeItems: "center", textDecoration: "none" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
          <span className="mono" style={{ fontSize: 9, letterSpacing: ".2em", color: "#5A7183" }}>设定卡</span>
        </div>

        <span aria-hidden style={{ position: "absolute", top: 62, left: "50%", transform: "translateX(-50%)", fontSize: bigNameSize(big), fontWeight: 800, letterSpacing: "-.035em", color: "rgba(255,255,255,.92)", whiteSpace: "nowrap", lineHeight: 1, zIndex: 1 }}>
          {big}
        </span>

        <div style={{ position: "absolute", top: 104, left: "50%", transform: "translateX(-50%)", width: 232, height: 278, borderRadius: 18, overflow: "hidden", zIndex: 2, boxShadow: "0 24px 48px rgba(24,44,62,.22)", background: "var(--surface-3)" }}>
          {hero.kind === "video" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              key={hero.url || "v"}
              src={hero.url || undefined}
              poster={hero.poster || undefined}
              autoPlay
              loop
              muted
              playsInline
              onPlaying={() => setPlayingUrl(hero.url || null)}
              onError={() => setBrokenUrl(hero.url || null)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : hero.kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={hero.url || ""} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <AssetPortrait name={c.name} hue={c.hue} width={232} height={278} radius={0} fontSize={68} />
          )}
          {hero.kind === "video" && playingUrl === hero.url && (
            <span style={{ position: "absolute", top: 10, left: 10, height: 22, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 5, borderRadius: 999, background: "rgba(12,24,34,.55)", color: "#fff", fontSize: 9.5, fontWeight: 700 }}>
              <span style={{ width: 5, height: 5, borderRadius: 99, background: "#6FE3A8" }} />
              循环播放中
            </span>
          )}
        </div>

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, zIndex: 3, padding: "0 20px" }}>
          <span className="mono" style={{ fontSize: 8.5, letterSpacing: ".16em", color: "#6F8496" }}>{c.id}</span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 30, fontWeight: 600, lineHeight: 1.15, maxWidth: 300, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
          {c.def?.设定语 && (
            <span style={{ fontSize: 11.5, color: "#3D5768", lineHeight: 1.6, textAlign: "center", maxWidth: 280, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.def.设定语}</span>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", padding: "0 20px" }}>
            {c.path === "ai" ? (
              <Badge tone="mute">AI 原创 · 无需授权</Badge>
            ) : !licenseKnown ? null : license?.status === "active" ? (
              <Badge tone="ok" dot>授权有效</Badge>
            ) : license?.status === "expired" ? (
              <Badge tone="err" dot>授权已到期</Badge>
            ) : (
              <Badge tone="warn" dot>待完成授权</Badge>
            )}
            {status && <Badge tone="info">{status.label}</Badge>}
          </div>
        </div>
      </div>

      {/* ── 资料带（杂志式细数据行）───────────────── */}
      <div style={{ display: "flex", gap: 16, padding: "12px 16px 0", borderBottom: "1px solid var(--line)", paddingBottom: 12, margin: "0 0 2px" }}>
        {[
          ["类型", c.archetype],
          ["来源", c.path === "real" ? "真人授权复刻" : "AI 原创"],
          ["版本", `V${c.versions || 1}`],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
            <span className="mono" style={{ fontSize: 8, letterSpacing: ".1em", color: "var(--ink-4)" }}>{k}</span>
            <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* ── 换一个样子看看 ─────────────────────────── */}
      <div style={{ padding: "16px 16px 0" }}>
        {derivs.loading ? (
          <LoadingBlock label="素材加载中" />
        ) : derivs.error && groups.length === 0 ? (
          <Card>
            <EmptyState text={`素材加载失败：${derivs.error}`} />
          </Card>
        ) : groups.length === 0 ? (
          <Card>
            <EmptyState text="还没有可切换的素材。生成表情、换装或运镜视频后，这里就能换着看" actionHref={studioHref(`#/avatar/${c.id}`)} actionLabel="去生成" />
          </Card>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>换一个样子看看</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)" }}>点一下即可切换</span>
            </div>
            {derivs.error && (
              <div style={{ marginBottom: 10, fontSize: 11.5, color: "var(--err)" }}>
                其余素材加载失败：{derivs.error}
              </div>
            )}
            <div style={{ display: "flex", gap: 20, borderBottom: "1px solid var(--line)", marginBottom: 12 }}>
              {groups.map((grp) => {
                const on = grp.key === activeTab;
                return (
                  <button
                    key={grp.key}
                    onClick={() => setTab(grp.key)}
                    style={{ position: "relative", padding: "0 0 9px", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: on ? 800 : 600, color: on ? "var(--ink)" : "var(--ink-3)", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {grp.label}
                    {on && <span style={{ position: "absolute", left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 99, background: "var(--primary)" }} />}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 2 }}>
              {activeItems.map((d) => {
                const on = picked === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setPicked(d.id)}
                    style={{ flexShrink: 0, width: 74, display: "flex", flexDirection: "column", gap: 6, background: "none", border: "none", padding: 0, cursor: "pointer" }}
                  >
                    <span style={{ display: "block", height: 84, borderRadius: 13, overflow: "hidden", background: "var(--surface-3)", border: on ? "2.5px solid var(--primary)" : "1px solid var(--line)", boxShadow: on ? "0 0 0 3px rgba(18,179,222,.14)" : "none" }}>
                      {d.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.thumbUrl} alt={d.label || ""} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      ) : null}
                    </span>
                    <span style={{ fontSize: 10.5, fontWeight: on ? 800 : 600, color: on ? "var(--primary-700)" : "var(--ink-2)", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {d.label || `第 ${d.idx + 1} 张`}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* 试听要有真实音频地址才做得了；现在只有音色名，就只展示绑定关系（review #9） */}
        {c.voiceName && (
          <Link href={studioHref(`#/avatar/${c.id}/voice`)} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "11px 13px", background: "var(--primary-tint)", borderRadius: 14 }}>
              <span style={{ width: 30, height: 30, borderRadius: 999, background: "var(--primary-soft)", display: "grid", placeItems: "center", flexShrink: 0, color: "var(--primary-700)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
                  <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
                  <line x1="12" y1="18" x2="12" y2="22" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>已绑定声音</span>
                <span style={{ fontSize: 11.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.voiceName}</span>
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary-700)", flexShrink: 0 }}>换一个 ›</span>
            </div>
          </Link>
        )}
      </div>

      {/* ── 授权证书 ───────────────────────────────── */}
      {c.path === "real" && !licenseKnown && (
        <div style={{ margin: "18px 16px 0" }}>
          <Card style={{ boxShadow: "none" }}>
            {licenses.loading ? (
              <span style={{ fontSize: 12, color: "var(--ink-3)" }}>授权状态加载中…</span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--err)" }}>授权状态加载失败：{licenses.error}</span>
            )}
          </Card>
        </div>
      )}
      {c.path === "real" && licenseKnown && (
        <div style={{ margin: "18px 16px 0" }}>
          <Link href={license?.status === "active" ? "/licenses" : studioHref(`#/avatar/${c.id}`)} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <Card style={license?.status === "active"
              ? { background: "var(--primary-tint)", border: "1px solid #D6EEF7", boxShadow: "none", display: "flex", alignItems: "center", gap: 12 }
              : { background: "var(--warn-s)", border: "1px solid #F2E2BE", boxShadow: "none", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: license?.status === "active" ? "var(--ink)" : "var(--warn)" }}>
                  {license?.status === "active" ? "真人授权证书" : "还没有完成真人授权"}
                </span>
                <span style={{ fontSize: 11.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {license?.status === "active"
                    ? license.verifyMethod === "liveness" ? "平台协议已确认 · 本人刷脸核验通过" : "书面授权登记"
                    : "确认平台协议 + 本人刷脸后才能出片"}
                </span>
                {license?.period && <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{license.period}</span>}
              </div>
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: license?.status === "active" ? "var(--primary-700)" : "var(--warn)" }}>
                {license?.status === "active" ? "查看证书 ›" : "去完成 ›"}
              </span>
            </Card>
          </Link>
        </div>
      )}

      {/* ── 还差几项 ───────────────────────────────── */}
      {g.items.length > 0 && (
        <div style={{ margin: "18px 16px 0" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800 }}>还差 {g.items.length} 项</span>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--primary-700)" }}>{g.done} / {g.total}</span>
            </div>
            <div style={{ height: 6, borderRadius: 999, background: "var(--surface-3)", overflow: "hidden", marginBottom: 11 }}>
              <div style={{ width: `${Math.round((g.done / g.total) * 100)}%`, height: "100%", borderRadius: 999, background: "var(--grad)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {g.items.map((it) => (
                <Link key={it.text} href={it.href} style={{ display: "flex", alignItems: "center", gap: 9, textDecoration: "none", color: "inherit" }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, border: "1.5px dashed var(--line-3)", flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600 }}>{it.text}</span>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--primary-700)", flexShrink: 0 }}>去补 ›</span>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── 被用在哪 ───────────────────────────────── */}
      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader title="被用在哪" count={usageKnown ? usedIn.length : undefined} />
        {!usageKnown ? (
          <Card>{refs.loading || compositions.loading ? <LoadingBlock label="使用记录加载中" /> : <EmptyState text={`使用记录加载失败：${refs.error || compositions.error}`} />}</Card>
        ) : usedIn.length === 0 ? (
          <Card>
            <EmptyState text="还没有被使用的记录，出一条片就有了" actionHref={studioHref(`#/avatar/${c.id}`)} actionLabel="去创作" />
          </Card>
        ) : (
          <Card pad={0}>
            {usedIn.slice(0, 5).map((u, i, arr) => (
              <ListRow key={u.key} divider={i < arr.length - 1} leading={<Badge tone="mute">{u.tag}</Badge>} title={u.title}
                trailing={<span className="mono" style={{ fontSize: 10, color: "var(--ink-4)", flexShrink: 0 }}>{u.when}</span>} />
            ))}
          </Card>
        )}
      </div>

      <div style={{ margin: "18px 16px 0" }}>
        <Link href={studioHref(`#/avatar/${c.id}`)} style={{ textDecoration: "none", display: "block" }}>
          <div style={{ height: 48, borderRadius: "var(--r-md)", background: "var(--grad)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14.5, fontWeight: 800, boxShadow: "0 8px 20px rgba(18,179,222,.3)" }}>
            去工作室创作
          </div>
        </Link>
      </div>
    </HubScreen>
  );
}
