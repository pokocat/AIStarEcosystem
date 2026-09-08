"use client";
// ============================================================
// 名片编辑 —— 这条链的最后一段：工作台起的名字和跑出来的造型都已经带过来了，
// 这里只补机器猜不出来的东西：一句话说清你是谁、做什么、怎么联系。
//
// 刻意做窄：一期只编辑首屏会显示的字段（名字 / 一句话 / 职位 / 城市 / 联系方式）
// 与衣柜顺序。作品、公司、履历等长内容留在后面 —— 名片先能递出去才有意义。
// ============================================================
import React, { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CardApi, type CardContact, type CardContactKind, type CardProfile } from "@/proto/card";
import { AvatarApi, USE_MOCK } from "@/proto/api";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { Card, HubScreen, LoadingBlock, NavBar, RegNo, SectionHeader } from "@/components/hub/ui";

const CONTACT_META: Array<{ kind: CardContactKind; label: string; placeholder: string; type?: string }> = [
  { kind: "phone", label: "电话", placeholder: "138 0013 8000", type: "tel" },
  { kind: "wechat", label: "微信", placeholder: "微信号", type: "text" },
  { kind: "email", label: "邮箱", placeholder: "you@example.com", type: "email" },
  { kind: "address", label: "地址", placeholder: "所在城市 / 办公地址", type: "text" },
];

type State =
  | { s: "loading" }
  | { s: "ok"; doc: CardProfile }
  | { s: "error"; message: string };

export default function CardEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const authState = useRequireAuth();
  const ready = authState === "ok";
  const [state, setState] = useState<State>({ s: "loading" });
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // 首页资源可选的视频 —— 来自这个形象在数字资产里的视频类衍生物
  // （IP 工作台发布时把画布上的成片一并登记了）。
  const [videos, setVideos] = useState<Array<{ id: string; label: string; thumbUrl?: string; spec?: string }>>([]);

  useEffect(() => {
    if (!ready) return;
    if (USE_MOCK) {
      setState({ s: "error", message: "演示模式下没有名片后端，编辑不可用" });
      return;
    }
    CardApi.detail(id)
      .then((doc) => {
        setState({ s: "ok", doc });
        // 拉视频候选是**旁路**：拉不到就只是「首页资源」那栏没有视频可选，
        // 不该把整张名片的编辑挡住。
        if (doc.avatarRegNo) {
          AvatarApi.derivatives(doc.avatarRegNo)
            .then((list: any[]) => setVideos(
              (list ?? [])
                .filter((d: any) => d?.kind === "video" && d?.id)
                .map((d: any) => ({ id: String(d.id), label: String(d.label || "动态形象"), thumbUrl: d.thumbUrl || undefined, spec: d.spec || undefined })),
            ))
            .catch(() => setVideos([]));
        }
      })
      .catch((e: unknown) => setState({ s: "error", message: e instanceof Error ? e.message : "名片读不出来" }));
  }, [id, ready]);

  const say = (t: string) => { setNote(t); setTimeout(() => setNote(null), 2200); };

  const patch = useCallback((fn: (d: CardProfile) => CardProfile) => {
    setState((cur) => (cur.s === "ok" ? { s: "ok", doc: fn(cur.doc) } : cur));
  }, []);

  const setContact = (kind: CardContactKind, value: string) => {
    patch((d) => {
      const rest = d.contacts.filter((c) => c.kind !== kind);
      const next: CardContact[] = value.trim()
        ? [...rest, { kind, value: value.trim(), shown: true }]
        : rest;
      // 保持 CONTACT_META 的顺序，免得每敲一个字联系方式就跳位置
      next.sort((a, b) =>
        CONTACT_META.findIndex((m) => m.kind === a.kind) - CONTACT_META.findIndex((m) => m.kind === b.kind));
      return { ...d, contacts: next };
    });
  };

  const save = async (thenPublish: boolean) => {
    if (state.s !== "ok") return;
    if (!state.doc.name.trim()) return say("先填个名字");
    setSaving(true);
    try {
      await CardApi.save(id, { doc: state.doc });
      if (thenPublish) {
        await CardApi.publish(id);
        say("已发布，链接可以递出去了");
        router.push("/cards");
        return;
      }
      say("已保存");
    } catch (e) {
      say(e instanceof Error ? e.message : "保存没成功");
    } finally {
      setSaving(false);
    }
  };

  // 发布的硬性前提（与服务端 CardService.publish 的校验一一对应）。
  // 两边各写一份是有意的：服务端那份是闸，这份是**在用户点之前就说清楚**。
  const missing = state.s === "ok"
    ? [
        state.doc.name?.trim() ? null : "名字",
        state.doc.title?.trim() ? null : "职位",
      ].filter((x): x is string => Boolean(x))
    : [];
  const canPublish = state.s === "ok" && missing.length === 0;
  // 「选了视频」以 motionRef 为准而不是 tier：服务端解析不出成片时会把 tier 打回 static，
  // 只看 tier 的话用户刚选完视频、保存一次回来就被打回图片，像是没保存上。
  const videoPicked = state.s === "ok" && Boolean(state.doc.figure.motionRef);

  if (authState === "no-platform") return <PlatformGateScreen />;
  if (!ready) return <HubScreen tabBar={false}>{null}</HubScreen>;

  return (
    <HubScreen tabBar={false}>
      <NavBar back="/cards" title="编辑名片" />

      {state.s === "loading" && <LoadingBlock />}

      {state.s === "error" && (
        <div style={{ margin: "12px 16px 0" }}>
          <Card><span style={{ fontSize: 13.5, color: "var(--ink-2)" }}>{state.message}</span></Card>
        </div>
      )}

      {state.s === "ok" && (
        <>
          <div style={{ margin: "6px 16px 0" }}>
            <Card pad={14}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-2)" }}>
                  形象和造型已经从数字资产带过来了，访客能在名片上点着换装看。
                  下面这些是机器猜不出来的。
                </span>
                <RegNo size={10.5}>{state.doc.regNo}</RegNo>
              </div>
            </Card>
          </div>

          {/* 首页资源：名片打开时第一眼看到的东西 —— 一张可切换装扮的图，或一条自动播一遍的视频。
              没有视频候选时整块不渲染：给一个点不了的选项，比不给更让人困惑。 */}
          {videos.length > 0 && (
            <>
              <SectionHeader title="首页资源" />
              <div style={{ margin: "0 16px" }}>
                <Card pad={14}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.7, color: "var(--ink-2)", paddingBottom: 10 }}>
                    名片打开时第一眼看到的东西。选图片时访客可以点着换装扮和表情；选视频会自动播一遍，播完可以重播。
                  </div>
                  <div style={{ display: "flex", gap: 8, paddingBottom: videoPicked ? 10 : 0 }}>
                    <HeroChoice
                      active={!videoPicked}
                      label="图片"
                      hint={`可切换 ${Math.max(1, (state.doc.figure.looks?.length ?? 0) + 1)} 套`}
                      onClick={() => patch((d) => ({ ...d, figure: { ...d.figure, tier: "static", motionRef: null } }))}
                    />
                    <HeroChoice
                      active={videoPicked}
                      label="视频"
                      hint={`${videos.length} 条可选`}
                      onClick={() => patch((d) => ({
                        ...d,
                        figure: {
                          ...d.figure,
                          tier: "motion",
                          // 之前没选过就默认第一条，省得用户点了「视频」还得再点一次
                          motionRef: d.figure.motionRef || `deriv:${videos[0].id}`,
                        },
                      }))}
                    />
                  </div>
                  {videoPicked && (
                    <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                      {videos.map((v) => {
                        const ref = `deriv:${v.id}`;
                        const on = state.doc.figure.motionRef === ref;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => patch((d) => ({ ...d, figure: { ...d.figure, tier: "motion", motionRef: ref } }))}
                            title={v.spec ? `${v.label} · ${v.spec}` : v.label}
                            style={{
                              flex: "0 0 auto", width: 92, padding: 0, borderRadius: 6, overflow: "hidden",
                              border: on ? "2px solid var(--primary)" : "1px solid var(--line)",
                              background: "var(--surface-2)", cursor: "pointer", textAlign: "left",
                            }}
                          >
                            <div style={{ height: 62, background: "var(--surface-3, #eee)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                              {v.thumbUrl
                                // eslint-disable-next-line @next/next/no-img-element
                                ? <img src={v.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                                : <span style={{ fontSize: 18, color: "var(--ink-3)" }}>▶</span>}
                            </div>
                            <div style={{ padding: "5px 6px", fontSize: 11, lineHeight: 1.35, color: on ? "var(--primary)" : "var(--ink-2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {v.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

          <SectionHeader title="基础信息" />
          <div style={{ margin: "0 16px" }}>
            <Card pad={14}>
              <FieldRow label="名字" required>
                <Input value={state.doc.name} placeholder="对外用的名字"
                  onChange={(v) => patch((d) => ({ ...d, name: v }))} />
              </FieldRow>
              <FieldRow label="字标" hint="名片顶部那排大写拉丁字母。留空就不显示。">
                <Input value={state.doc.latin} placeholder="BINGFENG"
                  onChange={(v) => patch((d) => ({ ...d, latin: v.toUpperCase() }))} />
              </FieldRow>
              <FieldRow label="一句话" hint="见客户时你最想让对方记住的一句。可以换行分两行。">
                <Textarea value={state.doc.headline} rows={2} placeholder={"帮连锁品牌\n把门店生意做到线上"}
                  onChange={(v) => patch((d) => ({ ...d, headline: v }))} />
              </FieldRow>
              {/* 服务端发布时硬要求 name + title（CARD_TITLE_REQUIRED）。
                  不在这儿标必填，用户就是填完一整页、点发布、才被一个没标过的字段拦住。 */}
              <FieldRow label="职位" required>
                <Input value={state.doc.title} placeholder="某某科技 · 创始人"
                  onChange={(v) => patch((d) => ({ ...d, title: v }))} />
              </FieldRow>
              <FieldRow label="城市" last>
                <Input value={state.doc.city} placeholder="南京"
                  onChange={(v) => patch((d) => ({ ...d, city: v }))} />
              </FieldRow>
            </Card>
          </div>

          <SectionHeader title="联系方式" />
          <div style={{ margin: "0 16px" }}>
            <Card pad={14}>
              {CONTACT_META.map((m, i) => (
                <FieldRow key={m.kind} label={m.label} last={i === CONTACT_META.length - 1}>
                  <Input
                    type={m.type}
                    value={state.doc.contacts.find((c) => c.kind === m.kind)?.value ?? ""}
                    placeholder={m.placeholder}
                    onChange={(v) => setContact(m.kind, v)}
                  />
                </FieldRow>
              ))}
            </Card>
          </div>

          <SectionHeader title="能提供 / 在找" />
          <div style={{ margin: "0 16px" }}>
            <Card pad={14}>
              <FieldRow label="能提供" hint="首屏只显示第一条。">
                <Textarea value={state.doc.offer.give.join("\n")} rows={3} placeholder="一行一条"
                  onChange={(v) => patch((d) => ({ ...d, offer: { ...d.offer, give: splitLines(v) } }))} />
              </FieldRow>
              <FieldRow label="在找" last>
                <Textarea value={state.doc.offer.want.join("\n")} rows={3} placeholder="一行一条"
                  onChange={(v) => patch((d) => ({ ...d, offer: { ...d.offer, want: splitLines(v) } }))} />
              </FieldRow>
            </Card>
          </div>

          <div style={{ margin: "18px 16px 0", display: "flex", gap: 8 }}>
            <button
              type="button" disabled={saving} onClick={() => void save(false)}
              style={{
                flex: 1, height: 46, borderRadius: "var(--r-md)", border: "1px solid var(--line-2)",
                background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit",
                fontSize: 14, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? .6 : 1,
              }}
            >
              保存草稿
            </button>
            <button
              type="button" disabled={saving || !canPublish} onClick={() => void save(true)}
              title={canPublish ? undefined : `还差：${missing.join(" · ")}`}
              style={{
                flex: 1.3, height: 46, borderRadius: "var(--r-md)", border: "none",
                background: "var(--ink)", color: "#fff", fontFamily: "inherit",
                fontSize: 14, fontWeight: 700,
                cursor: saving || !canPublish ? "default" : "pointer",
                opacity: saving || !canPublish ? .5 : 1,
              }}
            >
              {saving ? "处理中" : "保存并发布"}
            </button>
          </div>

          <div style={{ margin: "12px 24px 0", textAlign: "center", fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.7 }}>
            {/* 缺什么就在点之前说。服务端发布时硬校验 name + title，
                等点了才报错的话，用户已经填完一整页了。 */}
            {canPublish
              ? "发布后这张名片就能被任何拿到链接的人打开，不需要注册。随时可以取消发布。"
              : `还差 ${missing.join(" 和 ")} 才能发布 —— 草稿可以先存着。`}
          </div>
        </>
      )}

      {note && (
        <div style={{ position: "fixed", left: "50%", bottom: 40, transform: "translateX(-50%)", zIndex: 90 }}>
          <span style={{
            display: "inline-block", maxWidth: "78vw", background: "var(--ink)", color: "#fff",
            fontSize: 13, fontWeight: 600, borderRadius: "var(--r-sm)", padding: "9px 14px",
            boxShadow: "var(--sh-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{note}</span>
        </div>
      )}
    </HubScreen>
  );
}

// ── 表单小件 ────────────────────────────────────────────────

/** 一行一条，空行丢掉 —— 用户敲回车的节奏不该变成一堆空条目。 */
const splitLines = (v: string) => v.split("\n").map((x) => x.trim()).filter(Boolean);

function FieldRow({
  label, hint, required, last, children,
}: {
  label: string; hint?: string; required?: boolean; last?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={{ padding: "10px 0", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-2)" }}>{label}</span>
        {required && <span style={{ fontSize: 11, color: "var(--err)" }}>必填</span>}
      </div>
      {children}
      {hint && (
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 5, lineHeight: 1.6 }}>{hint}</div>
      )}
    </div>
  );
}

const FIELD_STYLE: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "9px 11px",
  border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)",
  background: "var(--surface)", color: "var(--ink)",
  fontFamily: "inherit", fontSize: 14, lineHeight: 1.5, outline: "none",
};

function Input({
  value, onChange, placeholder, type = "text",
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} placeholder={placeholder} style={FIELD_STYLE}
      onChange={(e) => onChange(e.target.value)} />
  );
}

function Textarea({
  value, onChange, placeholder, rows = 2,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} placeholder={placeholder} rows={rows}
      style={{ ...FIELD_STYLE, resize: "vertical" }}
      onChange={(e) => onChange(e.target.value)} />
  );
}

/** 首页资源二选一的那两个按钮。 */
function HeroChoice({ active, label, hint, onClick }: { active: boolean; label: string; hint: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1,
        minWidth: 0,
        padding: "9px 10px",
        borderRadius: 8,
        border: active ? "2px solid var(--primary)" : "1px solid var(--line)",
        background: active ? "var(--primary-soft, rgba(0,0,0,.03))" : "transparent",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: active ? "var(--primary)" : "var(--ink-1)" }}>{label}</div>
      <div style={{ fontSize: 11.5, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hint}</div>
    </button>
  );
}
