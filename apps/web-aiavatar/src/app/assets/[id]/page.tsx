"use client";
// ============================================================
// 资产名片（P1，数字人）：资产"身份证" + 设定卡。
// 上半：身份 / 授权证书 / 去创作 / 组成部分 / 被用在哪；
// 下半（设定卡）：完整度 / 标准图集 / 衍生货架 / 人设。
// 数据全部来自既有端点（avatar 详情 / references / licenses / compositions），
// 完整度由已填槽位前端推导 —— 不编造数字（设计文档 §3.3）。
// ============================================================
import React, { use as usePromise } from "react";
import Link from "next/link";
import { AvatarApi, ComposeApi, DATA, LicenseApi } from "@/proto/api";
import type { Avatar, AvatarReference, Composition, License } from "@/proto/data";
import { useRequireAuth } from "@/components/hub/auth";
import { settled, studioHref, useHubData } from "@/components/hub/data";
import {
  AssetPortrait,
  Badge,
  Card,
  EmptyState,
  HubScreen,
  LoadingBlock,
  ListRow,
  NavBar,
  RegNo,
  SectionHeader,
} from "@/components/hub/ui";

const APP_LABEL: Record<string, string> = { music: "音乐", drama: "短剧" };

/** 设定完整度：已填槽位 / 总槽位（标准图 5 + 衍生 6 + 声音 + 人设语）。 */
function completeness(c: Avatar): { pct: number; missing: string[]; missingTotal: number } {
  const missing: string[] = [];
  let filled = 0;
  const total = DATA.SHOTS.length + DATA.DERIVS.length + 2;
  const shotDone = DATA.SHOTS.filter((s) => c.shotImages?.[s.key]).length;
  filled += shotDone;
  if (shotDone < DATA.SHOTS.length) missing.push(`标准图 ${DATA.SHOTS.length - shotDone} 张`);
  const derivDone = DATA.DERIVS.filter((d) => c.deriv?.[d.key] === "done").length;
  filled += derivDone;
  if (derivDone < DATA.DERIVS.length) missing.push(`衍生 ${DATA.DERIVS.length - derivDone} 类`);
  if (c.voiceName) filled += 1;
  else missing.push("专属声音");
  if (c.def?.设定语) filled += 1;
  else missing.push("人设语");
  return { pct: Math.round((filled / total) * 100), missing: missing.slice(0, 2), missingTotal: missing.length };
}

export default function AssetCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const authState = useRequireAuth();
  const ready = authState === "ok";

  // 不吞错误（review #3）：失败进各自 error 态，页面按"未知"处理而不是当成"没有"。
  const avatar = useHubData<Avatar | null>(() => AvatarApi.get(id), null, [id], ready);
  const refs = useHubData<AvatarReference[]>(() => AvatarApi.references(id), [], [id], ready);
  const licenses = useHubData<License[]>(() => LicenseApi.list(), [], [id], ready);
  const compositions = useHubData<Composition[]>(() => ComposeApi.list(), [], [id], ready);

  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  const c = avatar.data;
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
  const usedIn: { key: string; tag: string; title: string; when: string; href: string }[] = [
    ...refs.data.map((r) => ({
      key: `ref-${r.app}-${r.ipId}`,
      tag: APP_LABEL[r.app] || r.app,
      title: `艺人「${r.ipName}」的形象`,
      when: (r.importedAt || "").slice(0, 10),
      href: studioHref(`#/avatar/${c.id}`),
    })),
    ...compositions.data
      .filter((cp) => cp.avatarId === c.id)
      .map((cp) => ({
        key: `cp-${cp.id}`,
        tag: "合成",
        title: "合成出片",
        when: cp.created,
        href: studioHref(`#/compose/${cp.id}`),
      })),
  ];
  const comp = completeness(c);
  const status = DATA.STATUS[c.status];

  return (
    <HubScreen>
      <NavBar back="/assets" title="资产名片" />

      <div style={{ margin: "6px 16px 0" }}>
        <Card radius={22} pad={16} style={{ display: "flex", gap: 15, boxShadow: "var(--sh-2)" }}>
          <AssetPortrait name={c.name} imageUrl={c.imageUrl} hue={c.hue} width={96} height={122} radius={17} fontSize={42} />
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 7, paddingTop: 4 }}>
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 26, fontWeight: 600, lineHeight: 1.1 }}>{c.name}</span>
            <RegNo size={10.5}>{`${c.id} · V${c.versions || 1} · ${c.archetype}`}</RegNo>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
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
            <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>
              {usageKnown ? `被用在 ${usedIn.length} 处 · ` : ""}更新于 {c.updated}
            </span>
          </div>
        </Card>
      </div>

      {c.path === "real" && !licenseKnown && (
        <div style={{ margin: "12px 16px 0" }}>
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
        <div style={{ margin: "12px 16px 0" }}>
          {license && license.status === "active" ? (
            <Link href="/licenses" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <Card style={{ background: "var(--primary-tint)", border: "1px solid #D6EEF7", boxShadow: "none", display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 13,
                    background: "var(--surface)",
                    border: "1px solid #D6EEF7",
                    display: "grid",
                    placeItems: "center",
                    color: "var(--primary)",
                    flexShrink: 0,
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800 }}>真人授权证书</span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {license.verifyMethod === "liveness" ? "平台协议已确认 · 本人刷脸核验通过" : "书面授权登记"}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{license.period}</span>
                </div>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--primary-700)" }}>查看证书 ›</span>
              </Card>
            </Link>
          ) : (
            <Link href={studioHref(`#/avatar/${c.id}`)} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
              <Card style={{ background: "var(--warn-s)", border: "1px solid #F2E2BE", boxShadow: "none", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--warn)" }}>还没有完成真人授权</span>
                  <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>确认平台协议 + 本人刷脸后才能出片</span>
                </div>
                <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "var(--warn)" }}>去完成 ›</span>
              </Card>
            </Link>
          )}
        </div>
      )}

      <div style={{ margin: "16px 16px 0", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-3)" }}>用它去创作</span>
        <Link href={studioHref(`#/avatar/${c.id}`)} style={{ textDecoration: "none", display: "block" }}>
          <div
            style={{
              height: 46,
              borderRadius: "var(--r-md)",
              background: "var(--grad)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 700,
              boxShadow: "0 2px 8px rgba(18,179,222,.3)",
            }}
          >
            去工作室创作（出片 / 衍生 / 合成）
          </div>
        </Link>
        <span style={{ fontSize: 10.5, color: "var(--ink-4)", textAlign: "center" }}>接入短剧 / 音乐创作入口在第二期上线</span>
      </div>

      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader title="组成部分" />
        <Card pad={0}>
          <ListRow
            href={studioHref(`#/avatar/${c.id}/voice`)}
            leading={<Badge tone="primary">声音</Badge>}
            title={c.voiceName || "还没有绑定声音"}
            sub={c.voiceName ? "专属声音 · 随人物一起授权" : "绑定后视频里就是 TA 的声线"}
          />
        </Card>
      </div>

      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader title="被用在哪" count={usageKnown ? usedIn.length : undefined} />
        {!usageKnown ? (
          <Card>
            {refs.loading || compositions.loading ? (
              <LoadingBlock label="使用记录加载中" />
            ) : (
              <EmptyState text={`使用记录加载失败：${refs.error || compositions.error}`} />
            )}
          </Card>
        ) : usedIn.length === 0 ? (
          <Card>
            <EmptyState text="还没有被使用的记录，出一条片就有了" actionHref={studioHref(`#/avatar/${c.id}`)} actionLabel="去创作" />
          </Card>
        ) : (
          <Card pad={0}>
            {usedIn.slice(0, 5).map((u, i, arr) => (
              <ListRow
                key={u.key}
                href={u.href}
                divider={i < arr.length - 1}
                leading={<Badge tone="mute">{u.tag}</Badge>}
                title={u.title}
                trailing={
                  <span className="mono" style={{ fontSize: 10, color: "var(--ink-4)", flexShrink: 0 }}>
                    {u.when}
                  </span>
                }
              />
            ))}
          </Card>
        )}
      </div>

      {/* ── 设定卡（生产资料区）───────────────────────────── */}

      <div style={{ margin: "22px 16px 0" }}>
        <Card style={{ background: "var(--primary-tint)", border: "1px solid #D6EEF7", boxShadow: "none", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>设定完整度</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--primary-700)" }}>{comp.pct}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: "var(--surface)", overflow: "hidden" }}>
            <div style={{ width: `${comp.pct}%`, height: "100%", borderRadius: 999, background: "var(--grad)" }} />
          </div>
          <span style={{ fontSize: 11, color: "var(--ink-2)" }}>
            设定越全，生成的视频里 TA 越不容易走样。
            {comp.missingTotal > 0
              ? `建议先补：${comp.missing.join("、")}${comp.missingTotal > comp.missing.length ? ` 等 ${comp.missingTotal} 项` : ""}`
              : "已经很完整了"}
          </span>
        </Card>
      </div>

      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader title="标准图集" count={`${DATA.SHOTS.filter((s) => c.shotImages?.[s.key]).length}/${DATA.SHOTS.length}`} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {DATA.SHOTS.map((s) => {
            const url = c.shotImages?.[s.key];
            return (
              <Link key={s.key} href={studioHref(`#/avatar/${c.id}/looks`)} style={{ textDecoration: "none", color: "inherit" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt={s.name} style={{ width: "100%", height: 118, objectFit: "cover", borderRadius: 13, display: "block" }} />
                  ) : (
                    <div
                      style={{
                        height: 118,
                        borderRadius: 13,
                        background: "var(--surface)",
                        border: "1.5px dashed var(--line-3)",
                        display: "grid",
                        placeItems: "center",
                        color: "var(--ink-4)",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      去补一张
                    </div>
                  )}
                  <span style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>{s.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ margin: "18px 16px 0" }}>
        <SectionHeader title="衍生货架" hint="表情 / 换装 / 场景 / 3D / 运镜" />
        <Card pad={0}>
          {DATA.DERIVS.map((d, i, arr) => {
            const st = c.deriv?.[d.key];
            const n = c.counts?.[d.key] ?? 0;
            return (
              <ListRow
                key={d.key}
                href={studioHref(`#/avatar/${c.id}/${d.key}`)}
                divider={i < arr.length - 1}
                title={d.name}
                sub={st === "done" ? `已有 ${n} ${d.unit}` : st === "running" ? "生成中" : "还没有，点进去生成"}
                trailing={
                  st === "done" ? <Badge tone="ok">已就绪</Badge> : st === "running" ? <Badge tone="primary" dot>生成中</Badge> : <Badge tone="mute">未生成</Badge>
                }
              />
            );
          })}
        </Card>
      </div>

      {(c.def?.设定语 || (c.def?.性格 || []).length > 0) && (
        <div style={{ margin: "18px 16px 0" }}>
          <SectionHeader title="人设" />
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {c.def?.设定语 && (
              <span style={{ fontFamily: "var(--font-serif)", fontSize: 13.5, lineHeight: 1.7 }}>{c.def.设定语}</span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              {[c.def?.气质, ...(c.def?.性格 || [])].filter(Boolean).map((t) => (
                <span
                  key={String(t)}
                  style={{
                    height: 24,
                    display: "inline-flex",
                    alignItems: "center",
                    padding: "0 10px",
                    border: "1px solid var(--line-2)",
                    color: "var(--ink-2)",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </Card>
        </div>
      )}
    </HubScreen>
  );
}
