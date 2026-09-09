"use client";
// ============================================================
// 我的名片（主人视角）。一个账号可以有多张 —— 对外身份可能不止一个。
//
// 这条路径要登录 + aiavatar 开通（被 /api/v1/** 兜底）；
// 公开页 /card/p/<slug> 是整条路由里唯一豁免登录的一段。
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { CardApi, DEMO_CARD_SLUG, type CardSummary } from "@/proto/card";
import { AvatarApi, USE_MOCK } from "@/proto/api";
import type { Avatar } from "@/proto/data";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { Badge, Card, EmptyState, HubScreen, LoadingBlock, NavBar, RegNo } from "@/components/hub/ui";

type State =
  | { s: "loading" }
  | { s: "ok"; rows: CardSummary[] }
  | { s: "error"; message: string };

/**
 * 名片行的预览图与名字。
 *
 * `CardSummary` 只有 id / slug / regNo / status / avatarId / publicUrl —— **没有图也没有名字**，
 * 所以原来这一页每张卡就是一行 URL 加一个登记号，光看文字根本认不出是谁的名片。
 * 逐张去拉完整 profile 是 N 次请求；这里改成**拉一次形象列表按 avatarId 对上号** ——
 * 名片的形象本来就来自数字资产，名字和定妆图都在那儿，不必让服务端多发一份。
 */
function useCardFigures(rows: CardSummary[], ready: boolean) {
  const [byAvatar, setByAvatar] = useState<Record<string, Avatar>>({});
  useEffect(() => {
    if (!ready || rows.length === 0) return;
    let alive = true;
    // 拉不到就不显示图，不挡列表本身（名片能不能打开跟有没有封面无关）
    void AvatarApi.list("mine")
      .then((list: Avatar[]) => {
        if (!alive) return;
        setByAvatar(Object.fromEntries(list.map((a) => [a.id, a])));
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [ready, rows.length]);
  return byAvatar;
}

export default function MyCardsPage() {
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const noPlatform = authState === "no-platform";
  const [state, setState] = useState<State>({ s: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // 请求序号：发布后会立刻重拉一次，慢的那次回来时必须丢掉 ——
  // 否则「发布成功 → 一闪又变回草稿」，用户还会以为没发布成功再点一次。
  const seq = useRef(0);
  const figures = useCardFigures(state.s === "ok" ? state.rows : [], ready);

  const load = useCallback(() => {
    if (!ready) return;
    // mock 模式没有后端，直接给一条演示行 —— 不打网络也不假装成功。
    if (USE_MOCK) {
      setState({
        s: "ok",
        rows: [{
          id: "CARD-demo", slug: DEMO_CARD_SLUG, regNo: "BC-2041", status: "published",
          avatarId: "DH-2041", publicUrl: `/card/p/${DEMO_CARD_SLUG}`,
          publishedAt: null, updatedAt: null,
        }],
      });
      return;
    }
    const mine = ++seq.current;
    setState({ s: "loading" });
    CardApi.mine()
      .then((rows) => { if (seq.current === mine) setState({ s: "ok", rows }); })
      .catch((e: unknown) => {
        if (seq.current !== mine) return;
        setState({ s: "error", message: e instanceof Error ? e.message : "名片列表没加载出来，刷新页面再试" });
      });
  }, [ready]);

  useEffect(load, [load]);

  const say = (t: string) => {
    setNote(t);
    setTimeout(() => setNote(null), 2200);
  };

  const toggle = async (row: CardSummary) => {
    if (USE_MOCK) return say("演示模式下不改状态");
    setBusy(row.id);
    try {
      if (row.status === "published") {
        await CardApi.unpublish(row.id);
        say("已取消发布，链接立刻打不开了");
      } else {
        await CardApi.publish(row.id);
        say("已发布，链接可以递出去了");
      }
      load();
    } catch (e) {
      say(e instanceof Error ? e.message : "操作没成功");
    } finally {
      setBusy(null);
    }
  };

  const copyLink = async (row: CardSummary) => {
    const url = `${window.location.origin}${row.publicUrl}`;
    try {
      await navigator.clipboard.writeText(url);
      say("链接已复制");
    } catch {
      say("复制没成功，长按地址栏手动复制");
    }
  };

  if (noPlatform) return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  return (
    <HubScreen>
      <NavBar back="/me" title="我的名片" />

      <div style={{ margin: "6px 16px 0" }}>
        <Card pad={14}>
          <span style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-2)" }}>
            名片是数字资产的<b style={{ color: "var(--ink)" }}>对外发布面</b> —— 形象直接引用你的数字人，
            换了形象名片自动跟着变。发布后拿到一条链接，见客户扫码就能打开，对方不用注册。
          </span>
        </Card>
      </div>

      {state.s === "loading" && <LoadingBlock />}

      {state.s === "error" && (
        <div style={{ margin: "12px 16px 0" }}>
          <Card>
            <EmptyState text={state.message} actionHref="/cards" actionLabel="重试" />
          </Card>
        </div>
      )}

      {state.s === "ok" && state.rows.length === 0 && (
        <div style={{ margin: "12px 16px 0" }}>
          <Card>
            <EmptyState
              text="还没有名片。打开一个数字人形象，在「数字名片」那一节点「做成数字名片」，名字和整柜造型会自动带过来，你只要再填联系方式。"
              actionHref="/assets"
              actionLabel="去打开一个形象"
            />
          </Card>
        </div>
      )}

      {state.s === "ok" && state.rows.map((row) => (
        <div key={row.id} style={{ margin: "12px 16px 0" }}>
          <Card pad={16}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              {/* 封面：名片的形象来自数字资产，这里直接用它的定妆图。
                  竖幅 3:4 —— 与发现页的角色卡同一形状，一眼看出「这是谁的名片」。 */}
              <span
                style={{
                  width: 54, aspectRatio: "3 / 4", flexShrink: 0, borderRadius: 10, overflow: "hidden",
                  background: "var(--surface-2)", display: "grid", placeItems: "center",
                }}
              >
                {figures[row.avatarId]?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={figures[row.avatarId].imageUrl}
                    alt=""
                    loading="lazy"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                ) : (
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 20, color: "var(--ink-4)" }}>
                    {(figures[row.avatarId]?.name || "?").trim().slice(0, 1)}
                  </span>
                )}
              </span>

              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-serif)", fontSize: 17, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {figures[row.avatarId]?.name || "未命名名片"}
                  </span>
                  <Badge tone={row.status === "published" ? "ok" : "mute"} dot>
                    {row.status === "published" ? "已发布" : "草稿"}
                  </Badge>
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {figures[row.avatarId]?.archetype || row.avatarId}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <RegNo size={10.5}>{row.regNo}</RegNo>
                  <span style={{ fontSize: 11, color: "var(--ink-4)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 }}>
                    {row.publicUrl}
                  </span>
                </span>
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {/* 草稿没有「打开」和「复制链接」—— 公开页对未发布的名片一律 404，
                  本人也一样。给按钮只会让人点出一个「找不到」页，或者把打不开的链接发出去。 */}
              {row.status === "published" ? (
                <>
                  <a
                    href={row.publicUrl}
                    style={{
                      flex: 1, minWidth: 0, height: 40, borderRadius: "var(--r-md)",
                      border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                      display: "grid", placeItems: "center", fontSize: 13.5, fontWeight: 700, textDecoration: "none",
                    }}
                  >
                    打开
                  </a>
                  <button
                    type="button"
                    onClick={() => copyLink(row)}
                    style={{
                      flex: 1, minWidth: 0, height: 40, borderRadius: "var(--r-md)",
                      border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                      fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    复制链接
                  </button>
                </>
              ) : (
                <span style={{
                  flex: 1, minWidth: 0, height: 40, borderRadius: "var(--r-md)",
                  background: "var(--surface-2)", color: "var(--ink-3)",
                  display: "grid", placeItems: "center", fontSize: 12, padding: "0 8px",
                  textAlign: "center", lineHeight: 1.3,
                }}>
                  未发布
                </span>
              )}
              <a
                href={`/cards/${encodeURIComponent(row.id)}/edit`}
                style={{
                  flex: 1, minWidth: 0, height: 40, borderRadius: "var(--r-md)",
                  border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)",
                  display: "grid", placeItems: "center", fontSize: 13.5, fontWeight: 700, textDecoration: "none",
                }}
              >
                编辑
              </a>
              <button
                type="button"
                disabled={busy === row.id}
                onClick={() => toggle(row)}
                style={{
                  flex: 1.2, minWidth: 0, height: 40, borderRadius: "var(--r-md)", border: "none",
                  background: row.status === "published" ? "var(--surface-3)" : "var(--ink)",
                  color: row.status === "published" ? "var(--ink)" : "#fff",
                  fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
                  cursor: busy === row.id ? "default" : "pointer", opacity: busy === row.id ? .6 : 1,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}
              >
                {busy === row.id ? "处理中" : row.status === "published" ? "取消发布" : "发布"}
              </button>
            </div>
          </Card>
        </div>
      ))}

      {note && (
        <div style={{ position: "fixed", left: "50%", bottom: 96, transform: "translateX(-50%)", zIndex: 90 }}>
          <span style={{
            display: "inline-block", maxWidth: "78vw", background: "var(--ink)", color: "#fff",
            fontSize: 13, fontWeight: 600, borderRadius: "var(--r-sm)", padding: "9px 14px",
            boxShadow: "var(--sh-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{note}</span>
        </div>
      )}

      <div style={{ margin: "20px 24px 0", textAlign: "center", fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.7 }}>
        {USE_MOCK
          ? "演示模式：这里只展示一张内置样例名片，改动不会保存。"
          : "取消发布后链接立刻打不开；形象被删或授权撤销时，名片会回落到已缓存的图并通知你。"}
      </div>
    </HubScreen>
  );
}
