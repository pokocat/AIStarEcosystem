"use client";
// ============================================================
// 我的名片（主人视角）。一个账号可以有多张 —— 对外身份可能不止一个。
//
// 这条路径要登录 + aiavatar 开通（被 /api/v1/** 兜底）；
// 公开页 /card/p/<slug> 是整条路由里唯一豁免登录的一段。
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import { CardApi, DEMO_CARD_SLUG, type CardSummary } from "@/proto/card";
import { USE_MOCK } from "@/proto/api";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { Badge, Card, EmptyState, HubScreen, LoadingBlock, NavBar, RegNo } from "@/components/hub/ui";

type State =
  | { s: "loading" }
  | { s: "ok"; rows: CardSummary[] }
  | { s: "error"; message: string };

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
        setState({ s: "error", message: e instanceof Error ? e.message : "名片列表读不出来" });
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
              text="还没有名片。先去数字资产挑一个形象，再建一张。"
              actionHref="/assets"
              actionLabel="去挑形象"
            />
          </Card>
        </div>
      )}

      {state.s === "ok" && state.rows.map((row) => (
        <div key={row.id} style={{ margin: "12px 16px 0" }}>
          <Card pad={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5 }}>
                <span style={{ fontSize: 16, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {row.publicUrl}
                </span>
                <RegNo size={10.5}>{row.regNo}</RegNo>
              </span>
              <Badge tone={row.status === "published" ? "ok" : "mute"} dot>
                {row.status === "published" ? "已发布" : "草稿"}
              </Badge>
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
                  flex: 2, minWidth: 0, height: 40, borderRadius: "var(--r-md)",
                  background: "var(--surface-2)", color: "var(--ink-3)",
                  display: "grid", placeItems: "center", fontSize: 12.5, padding: "0 10px",
                  textAlign: "center", lineHeight: 1.3,
                }}>
                  发布后才有可以递出去的链接
                </span>
              )}
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
