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
import { CardApi, DEMO_CARD_SLUG, type CardContact, type CardContactKind, type CardProfile } from "@/proto/card";
import { AvatarApi, USE_MOCK } from "@/proto/api";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { Card, HubScreen, LoadingBlock, NavBar, RegNo, SectionHeader } from "@/components/hub/ui";
import { PersonaStudio } from "@/components/card/persona-studio";

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
  // 有没有改过还没存。人设那块聊完「采用」也只是填进表单，
  // 用户据此直接返回就白聊了 —— 至少要拦一下。
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // 首页资源可选的视频 —— 来自这个形象在数字资产里的视频类衍生物
  // （IP 工作台发布时把画布上的成片一并登记了）。
  const [videos, setVideos] = useState<Array<{ id: string; label: string; thumbUrl?: string; spec?: string }>>([]);

  // 浏览器级的离开提醒（刷新 / 关标签 / 前进后退）。站内跳转拦不住，
  // 所以底部按钮区另有一行「未保存」提示 —— 两者都不是万能，但比什么都没有强。
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!ready) return;
    if (USE_MOCK) {
      // 演示模式没有名片后端。原来这里直接报错「编辑不可用」—— 于是整个编辑页
      // 在 demo 下根本打不开，改版也没法自查。改成**装载演示名片供浏览**：
      // 保存与发布仍然会被 CardApi 的 mock 分支挡下并如实说明，
      // AI 人设对话同理（没有模型可调就说没有，不编一段假人设，§8.0）。
      void CardApi.bySlug(DEMO_CARD_SLUG).then((doc) => setState({ s: "ok", doc }));
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
                .map((d: any, i: number) => ({ id: String(d.id), label: tidyLabel(d.label, i), thumbUrl: d.thumbUrl || undefined, spec: d.spec || undefined })),
            ))
            .catch(() => setVideos([]));
        }
      })
      .catch((e: unknown) => setState({ s: "error", message: e instanceof Error ? e.message : "名片读不出来" }));
  }, [id, ready]);

  const say = (t: string) => { setNote(t); setTimeout(() => setNote(null), 2200); };

  const patch = useCallback((fn: (d: CardProfile) => CardProfile) => {
    setDirty(true);
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
      setDirty(false);
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
  if (!ready) return <HubScreen tabBar={false} width="form">{null}</HubScreen>;

  return (
    <HubScreen tabBar={false} width="form">
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

          {/* 人设放在基础信息之后、其余内容之前：它是「怎么说」的规格，
              「按人设改写文案」会回头把一句话 / 能提供 / 在找顺一遍。 */}
          <SectionHeader title="人设" />
          <div style={{ margin: "0 16px" }}>
            <Card pad={14}>
              <PersonaStudio cardId={id} doc={state.doc} onPatch={patch} />
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

          {/* 下面这几段名片上都会渲染，但原来编辑器一个都没覆盖 ——
              用户只能看着自己的名片上挂着建卡时带过来的内容，改不了。 */}
          <SectionHeader title="代表作品" />
          <div style={{ margin: "0 16px" }}>
            <Card pad={14}>
              <ListEditor
                items={state.doc.works}
                onChange={(works) => patch((d) => ({ ...d, works }))}
                // 用「现有最大号 + 1」而不是 length + 1：01/02/03 删掉 02 再加，
                // length 法会得到 01/03/03 —— 编号重复，公开页还拿 no 当 React key。
                blank={() => ({
                  no: String(
                    state.doc.works.reduce((mx, w) => Math.max(mx, Number(w.no) || 0), 0) + 1,
                  ).padStart(2, "0"),
                  title: "", desc: "", tone: "var(--primary)",
                })}
                addLabel="加一个作品"
                render={(w, set) => (
                  <>
                    <FieldRow label="标题">
                      <Input value={w.title} placeholder="做了什么" onChange={(v) => set({ ...w, title: v })} />
                    </FieldRow>
                    <FieldRow label="说明" last>
                      <Textarea value={w.desc} rows={2} placeholder="一两句说清楚它解决了什么"
                        onChange={(v) => set({ ...w, desc: v })} />
                    </FieldRow>
                  </>
                )}
              />
            </Card>
          </div>

          <SectionHeader title="公司" />
          <div style={{ margin: "0 16px" }}>
            <Card pad={14}>
              <FieldRow label="名称">
                <Input value={state.doc.company.name} placeholder="公司全称"
                  onChange={(v) => patch((d) => ({ ...d, company: { ...d.company, name: v } }))} />
              </FieldRow>
              <FieldRow label="一行简介" hint="行业 · 规模 · 成立年份这类。">
                <Input value={state.doc.company.meta} placeholder="连锁零售数字化 · 2019 年创立"
                  onChange={(v) => patch((d) => ({ ...d, company: { ...d.company, meta: v } }))} />
              </FieldRow>
              <FieldRow label="介绍">
                <Textarea value={state.doc.company.intro} rows={3} placeholder="在做什么、服务谁"
                  onChange={(v) => patch((d) => ({ ...d, company: { ...d.company, intro: v } }))} />
              </FieldRow>
              <FieldRow label="关键数字" hint="名片上并排显示的那几个数（客户数、门店数、服务年限…）。">
                <ListEditor
                  items={state.doc.company.stats}
                  onChange={(stats) => patch((d) => ({ ...d, company: { ...d.company, stats } }))}
                  blank={() => ({ value: "", label: "" })}
                  addLabel="加一个数字"
                  render={(st, set) => (
                    <>
                      <FieldRow label="数值">
                        <Input value={st.value} placeholder="300+" onChange={(v) => set({ ...st, value: v })} />
                      </FieldRow>
                      <FieldRow label="说明" last>
                        <Input value={st.label} placeholder="服务品牌" onChange={(v) => set({ ...st, label: v })} />
                      </FieldRow>
                    </>
                  )}
                />
              </FieldRow>
              <FieldRow label="大事记" last hint="按时间排。名片上是一条竖线串起来的。">
                <ListEditor
                  items={state.doc.company.milestones}
                  onChange={(milestones) => patch((d) => ({ ...d, company: { ...d.company, milestones } }))}
                  blank={() => ({ year: "", text: "" })}
                  addLabel="加一条"
                  render={(ms, set) => (
                    <>
                      <FieldRow label="年份">
                        <Input value={ms.year} placeholder="2019" onChange={(v) => set({ ...ms, year: v })} />
                      </FieldRow>
                      <FieldRow label="发生了什么" last>
                        <Input value={ms.text} placeholder="公司成立，第一家门店上线" onChange={(v) => set({ ...ms, text: v })} />
                      </FieldRow>
                    </>
                  )}
                />
              </FieldRow>
            </Card>
          </div>

          <SectionHeader title="媒体与资料" />
          <div style={{ margin: "0 16px" }}>
            <Card pad={14}>
              <ListEditor
                items={state.doc.media}
                onChange={(media) => patch((d) => ({ ...d, media }))}
                blank={() => ({ kind: "article" as const, title: "", meta: "" })}
                addLabel="加一条"
                render={(m, set) => (
                  <>
                    <FieldRow label="类型">
                      <div style={{ display: "flex", gap: 6 }}>
                        {(["video", "article", "doc"] as const).map((k) => (
                          <button
                            key={k} type="button" onClick={() => set({ ...m, kind: k })}
                            style={{
                              flex: 1, height: 32, borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5,
                              border: m.kind === k ? "1px solid var(--primary)" : "1px solid var(--line-2)",
                              background: m.kind === k ? "var(--primary-soft)" : "var(--surface)",
                              color: m.kind === k ? "var(--primary-700)" : "var(--ink-2)", fontWeight: 700,
                            }}
                          >
                            {k === "video" ? "视频" : k === "article" ? "文章" : "资料"}
                          </button>
                        ))}
                      </div>
                    </FieldRow>
                    <FieldRow label="标题">
                      <Input value={m.title} placeholder="标题" onChange={(v) => set({ ...m, title: v })} />
                    </FieldRow>
                    <FieldRow label="说明" last>
                      <Input value={m.meta} placeholder="来源 · 时长 / 篇幅" onChange={(v) => set({ ...m, meta: v })} />
                    </FieldRow>
                  </>
                )}
              />
            </Card>
          </div>

          <SectionHeader title="履历" />
          <div style={{ margin: "0 16px" }}>
            <Card pad={14}>
              <ListEditor
                items={state.doc.resume}
                onChange={(resume) => patch((d) => ({ ...d, resume }))}
                blank={() => ({ title: "", period: "" })}
                addLabel="加一段经历"
                render={(r, set) => (
                  <>
                    <FieldRow label="职位 / 身份">
                      <Input value={r.title} placeholder="某某科技 · 产品负责人" onChange={(v) => set({ ...r, title: v })} />
                    </FieldRow>
                    <FieldRow label="时间" last>
                      <Input value={r.period} placeholder="2019 — 至今" onChange={(v) => set({ ...r, period: v })} />
                    </FieldRow>
                  </>
                )}
              />
            </Card>
          </div>

          {dirty && (
            <p style={{ margin: "16px 16px 0", fontSize: 12, color: "var(--warn, #B26B00)", lineHeight: 1.7 }}>
              有改动还没保存 —— 包括人设那块「采用」进来的内容。
            </p>
          )}

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

/**
 * 视频资产名在画布里就是那段提示词（带换行、带「【主体与画风】」这种分段标记）。
 * 服务端从 v0.181 起登记时已经收拾过，但**回填进来的老行还是原样** —— 这里再收一次，
 * 不必为了几行历史数据去改库。
 */
function tidyLabel(raw: unknown, idx: number): string {
  const first = String(raw ?? "").split("\n")[0].replace(/【[^】]*】/g, " ").replace(/\s+/g, " ").trim();
  // 优先在标点处断开，硬切会切出「…潮玩女孩，纯」这种半句
  const stop = first.slice(0, 15).search(/[，。；、,.;]/);
  const cut = stop > 0 ? first.slice(0, stop) : first.slice(0, 14);
  return cut || `动态形象 ${idx + 1}`;
}

/**
 * 一组条目的增删改（作品 / 履历共用）。
 *
 * 刻意不做拖拽排序：一期这两组都只有两三条，上下移动两个按钮就够；
 * 拖拽在手机上还容易和页面滚动打架。
 */
function ListEditor<T>({
  items, onChange, blank, render, addLabel,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  blank: () => T;
  render: (item: T, set: (v: T) => void) => React.ReactNode;
  addLabel: string;
}) {
  const setAt = (i: number, v: T) => onChange(items.map((x, j) => (j === i ? v : x)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it, i) => (
        <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 11, padding: "4px 11px 6px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, paddingTop: 6 }}>
            <MiniBtn label="上移" onClick={() => move(i, -1)} disabled={i === 0}>↑</MiniBtn>
            <MiniBtn label="下移" onClick={() => move(i, 1)} disabled={i === items.length - 1}>↓</MiniBtn>
            <MiniBtn label="删除" onClick={() => onChange(items.filter((_, j) => j !== i))} danger>✕</MiniBtn>
          </div>
          {render(it, (v) => setAt(i, v))}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, blank()])}
        style={{
          height: 38, borderRadius: 10, border: "1px dashed var(--line-2)", background: "var(--surface-2)",
          color: "var(--ink-2)", fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
        }}
      >
        + {addLabel}
      </button>
    </div>
  );
}

function MiniBtn({
  children, label, onClick, disabled, danger,
}: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      style={{
        width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line-2)",
        background: "var(--surface)", cursor: disabled ? "default" : "pointer",
        color: danger ? "var(--err)" : "var(--ink-3)", fontSize: 12, lineHeight: 1,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      {children}
    </button>
  );
}
