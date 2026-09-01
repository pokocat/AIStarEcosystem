"use client";
// ============================================================
// 官方资产详情（M2 前置 · 只读）：B 版「角色名片」形态 —— 先认识角色，再谈授权。
// 数据来自既有「数字人广场」（AvatarApi.list("public")，服务端已实现），
// 按 id 在列表里取，不新增端点。
//
// 授权链路尚未打通：档位与价格字段还不存在，所以这里既不编价格、
// 也不假装能下单 —— 点「立即授权」只提示建设中（设计文档 §1.5）。
// ============================================================
import React, { use as usePromise, useState } from "react";
import Link from "next/link";
import { AvatarApi } from "@/proto/api";
import type { Avatar } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { useHubData } from "@/components/hub/data";
import { Badge, Card, EmptyState, HubScreen, LoadingBlock, NavBar } from "@/components/hub/ui";

export default function MarketAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = usePromise(params);
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";
  const list = useHubData<Avatar[]>(() => AvatarApi.list("public"), [], [id], ready);
  const [notice, setNotice] = useState(false);

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  if (list.loading) {
    return (
      <HubScreen>
        <NavBar back="/discover" title="官方资产" />
        <LoadingBlock />
      </HubScreen>
    );
  }
  const c = list.data.find((x) => x.id === id);
  if (list.error || !c) {
    return (
      <HubScreen>
        <NavBar back="/discover" title="官方资产" />
        <Card style={{ margin: "12px 16px 0" }}>
          <EmptyState text={list.error ? `加载失败：${list.error}` : "没有找到这个官方资产"} actionHref="/assets" actionLabel="回资产货架" />
        </Card>
      </HubScreen>
    );
  }

  const tags = [c.def?.气质, ...(c.def?.性格 || [])].filter(Boolean) as string[];

  return (
    <HubScreen>
      {/* 角色主视觉：先认识人 */}
      <div style={{ position: "relative", height: 404, overflow: "hidden", background: `linear-gradient(160deg, hsl(${c.hue ?? 200} 55% 82%), hsl(${c.hue ?? 200} 48% 66%))`, flexShrink: 0 }}>
        {c.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <span style={{ position: "absolute", top: 90, left: "50%", transform: "translateX(-50%)", fontFamily: "var(--font-serif)", fontSize: 120, color: "rgba(255,255,255,.85)" }}>
            {(c.name || "?").trim().slice(0, 1)}
          </span>
        )}
        <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,26,38,.34) 0%, rgba(8,26,38,0) 26%, rgba(8,26,38,.44) 62%, rgba(8,26,38,.9))" }} />

        <div style={{ position: "absolute", top: "calc(env(safe-area-inset-top, 0px) + 12px)", left: 16 }}>
          <Link href="/assets" aria-label="返回" style={{ width: 38, height: 38, borderRadius: 999, background: "rgba(255,255,255,.86)", display: "grid", placeItems: "center", textDecoration: "none" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </Link>
        </div>

        <div style={{ position: "absolute", left: 20, right: 20, bottom: 20, display: "flex", flexDirection: "column", gap: 9 }}>
          <span className="mono" style={{ fontSize: 9.5, letterSpacing: ".16em", color: "rgba(255,255,255,.62)" }}>{c.id} · 官方出品</span>
          <span style={{ fontFamily: "var(--font-serif)", fontSize: 34, fontWeight: 600, color: "#fff", lineHeight: 1.1, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {c.name}
          </span>
          {c.def?.设定语 && (
            <span style={{ fontFamily: "var(--font-serif)", fontSize: 13.5, fontStyle: "italic", color: "rgba(255,255,255,.9)", lineHeight: 1.65, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {c.def.设定语}
            </span>
          )}
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {tags.slice(0, 4).map((t) => (
                <span key={t} style={{ height: 24, padding: "0 11px", display: "inline-flex", alignItems: "center", borderRadius: 999, background: "rgba(255,255,255,.18)", color: "#fff", fontSize: 11, fontWeight: 700, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 资料带 */}
      <div style={{ display: "flex", gap: 16, padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
        {[
          ["类型", c.archetype],
          ["来源", c.path === "real" ? "真人授权复刻" : "AI 原创"],
          ["音色", c.voiceName || "未绑定"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
            <span className="mono" style={{ fontSize: 8, letterSpacing: ".1em", color: "var(--ink-4)" }}>{k}</span>
            <span className="mono" style={{ fontSize: 9.5, color: "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
          </div>
        ))}
      </div>

      {c.def?.用途 && (
        <div style={{ margin: "16px 16px 0" }}>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13.5, fontWeight: 800 }}>适合用来做什么</span>
              <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.8 }}>{c.def.用途}</span>
            </div>
          </Card>
        </div>
      )}

      {/* 授权：链路未打通，如实说明 */}
      <div style={{ margin: "16px 16px 0" }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>授权</span>
            <Badge tone="warn">建设中</Badge>
          </div>
          <span style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.8 }}>
            授权档位与在线付费正在建设。需要用这个角色出片，先联系客户经理线下开通。
          </span>
          <button
            onClick={() => setNotice(true)}
            style={{ marginTop: 12, width: "100%", height: 46, borderRadius: "var(--r-md)", background: "var(--surface-3)", color: "var(--ink-3)", border: "none", fontSize: 14.5, fontWeight: 700, cursor: "pointer" }}
          >
            立即授权
          </button>
          {notice && (
            <div role="status" style={{ marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "var(--warn-s)", color: "var(--warn)", fontSize: 12, fontWeight: 600, lineHeight: 1.7 }}>
              授权功能还在建设中，暂时无法在线下单。可以先联系客户经理开通。
            </div>
          )}
        </Card>
      </div>

      <div style={{ margin: "16px 24px 0", textAlign: "center", fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.7 }}>
        明星形象的授权申请与审批在「明星工作台」完成，不在这里下单。
      </div>
    </HubScreen>
  );
}
