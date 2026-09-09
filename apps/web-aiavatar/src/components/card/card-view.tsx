"use client";
// ============================================================
// AI 数字名片 · 公开页（访客视角，无需登录）
//
// 视觉真源：「棚」—— 形象本来就是纯白棚拍出来的，那就把整张名片做成一个
// 摄影棚。每屏一卷无缝背景纸，人站在原地，背后的纸一卷一卷换。配色沿用
// 数字资产平台的 Studio Cyan / 冷白（globals.css 的 --primary / --ink / --canvas）。
//
// 三条实现红线（docs/digital-business-card-plan.md §6 / §8）：
//   1. 首屏底色 = #FFFFFF，与形象图的棚拍白同色 —— 图片矩形因此隐形，
//      不靠遮罩硬遮。换成视频时同一条规则照用。
//   2. 形象只做底部溶解（linear mask），不要径向遮罩 —— 径向会把帽顶吃掉。
//   3. 巨号字标是刊头，不压在人身上。手机上干净带只有 ~56px，压不下 73px 的字。
// ============================================================
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { CardContact, CardContactKind, CardProfile } from "@/proto/card";
import { buildVCard } from "@/proto/card";
import { formatDateTime } from "@/lib/datetime";

// 字标专用字体。只有名片公开页加载，不进全局 layout。
const CARD_FONT =
  "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&display=swap";

const ROLL = {
  paper: "#FFFFFF",
  mist: "#CFE9F4",
  chalk: "var(--canvas)",
  slate: "#0F2836",
} as const;

const ON_SLATE = "#F2F8FB";
const ON_SLATE_2 = "rgba(242,248,251,.68)";
const ON_SLATE_3 = "rgba(242,248,251,.44)";
const LINE_SLATE = "rgba(230,245,250,.20)";

const DISP = "'Big Shoulders Display','Oswald',var(--font-disp)";

const CONTACT_LABEL: Record<CardContactKind, string> = {
  phone: "电话",
  wechat: "微信",
  email: "邮箱",
  address: "地址",
};

/** 微信内置浏览器拦下载，.vcf 存不进去 —— 必须换一条路，不能让按钮点了没反应。 */
function inWeChat(): boolean {
  if (typeof navigator === "undefined") return false;
  return /micromessenger/i.test(navigator.userAgent);
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 继续走兜底 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

// ── 小原语 ──────────────────────────────────────────────────

const Mono: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({
  children,
  color = "var(--ink-3)",
  style,
}) => (
  <span
    className="mono"
    style={{
      fontSize: 9.5,
      fontWeight: 500,
      letterSpacing: ".1em",
      textTransform: "uppercase",
      color,
      ...style,
    }}
  >
    {children}
  </span>
);

/** 换纸带：两卷纸之间的渐变过渡，不硬切。 */
const Band: React.FC<{ from: string; to: string; a: string; b: string; onDark?: boolean }> = ({
  from,
  to,
  a,
  b,
  onDark,
}) => (
  <div
    aria-hidden
    style={{
      height: 82,
      background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`,
      position: "relative",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 16,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
      }}
    >
      <Mono color={onDark ? ON_SLATE_3 : "rgba(20,32,43,.42)"}>{a}</Mono>
      <svg width="20" height="9" viewBox="0 0 26 14" fill="none" aria-hidden
        stroke={onDark ? ON_SLATE_3 : "rgba(20,32,43,.42)"} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <line x1="1" y1="7" x2="23" y2="7" />
        <polyline points="17,1 23,7 17,13" />
      </svg>
      <Mono color={onDark ? ON_SLATE_3 : "rgba(20,32,43,.42)"}>{b}</Mono>
    </div>
  </div>
);

/** 卷纸的上下暗角 —— 纸从上方垂下、在底部卷到地面。 */
const Cove: React.FC<{ dark?: boolean }> = ({ dark }) => (
  <div
    aria-hidden
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: dark
        ? "radial-gradient(130% 42% at 50% -16%, rgba(0,0,0,.16), transparent 58%), radial-gradient(140% 62% at 50% 114%, rgba(0,0,0,.30), transparent 66%)"
        : "radial-gradient(130% 42% at 50% -16%, rgba(20,32,43,.05), transparent 58%), radial-gradient(140% 62% at 50% 114%, rgba(20,32,43,.13), transparent 66%)",
    }}
  />
);

const Toast: React.FC<{ text: string | null }> = ({ text }) => (
  <div
    aria-live="polite"
    style={{
      position: "fixed",
      left: "50%",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 92px)",
      transform: "translateX(-50%)",
      zIndex: 90,
      pointerEvents: "none",
      opacity: text ? 1 : 0,
      transition: "opacity .18s ease",
    }}
  >
    <span
      style={{
        display: "inline-block",
        maxWidth: "78vw",
        background: "var(--ink)",
        color: "#fff",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 8,
        padding: "9px 14px",
        boxShadow: "var(--sh-3)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {text || ""}
    </span>
  </div>
);

// ── 主组件 ──────────────────────────────────────────────────

export default function CardView({ card }: { card: CardProfile }) {
  const [toast, setToast] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((t: string) => {
    setToast(t);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2000);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const shown = card.contacts.filter((c) => c.shown);
  const wechat = shown.find((c) => c.kind === "wechat");
  const phone = shown.find((c) => c.kind === "phone");

  const saveContact = useCallback(() => {
    // 微信里下载被拦，直接给可复制的面板，不让按钮点了没反应。
    if (inWeChat()) {
      setSheet(true);
      return;
    }
    try {
      const blob = new Blob([`﻿${buildVCard(card)}`], { type: "text/vcard;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${card.name}.vcf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      say("已生成联系人文件，按提示存入通讯录");
    } catch {
      setSheet(true);
    }
  }, [card, say]);

  const copy = useCallback(
    async (label: string, value: string) => {
      const ok = await copyText(value);
      say(ok ? `${label}已复制` : "复制没成功，长按选中试试");
    },
    [say],
  );

  return (
    <>
      <link rel="stylesheet" href={CARD_FONT} />
      <div style={{ background: ROLL.paper, color: "var(--ink)", minHeight: "100dvh" }}>
        <Hero card={card} phone={phone} onSave={saveContact} onWechat={() => (wechat ? copy("微信号", wechat.value) : saveContact())} hasWechat={!!wechat} />

        <Band from={ROLL.paper} to={ROLL.mist} a="Roll 01 · 纸白" b="Roll 02 · 青雾" />
        <Works card={card} />

        <Band from={ROLL.mist} to="#F7F9FB" a="Roll 02 · 青雾" b="Roll 03 · 灰白" />
        <Company card={card} />

        <Band from="#F7F9FB" to={ROLL.slate} a="Roll 03 · 灰白" b="Roll 04 · 深青墨" onDark />
        <Contact card={card} shown={shown} onCopy={copy} onSave={saveContact} />
      </div>

      <Toast text={toast} />
      {sheet && <ContactSheet card={card} shown={shown} onCopy={copy} onClose={() => setSheet(false)} />}
    </>
  );
}

/**
 * 换装条 —— 名片上唯一的互动。
 *
 * 放在形象右侧竖排：横排会压在人脸下沿的溶解带上，竖排贴着屏幕右缘，
 * 而形象是居中的 340px，两者基本不打架。
 */
const Wardrobe: React.FC<{
  items: Array<{ label: string; url: string }>;
  activeIdx: number;
  onPick: (i: number) => void;
}> = ({ items, activeIdx, onPick }) => (
  <div
    role="group"
    aria-label="切换装扮与表情"
    style={{
      position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
      zIndex: 7, display: "flex", flexDirection: "column", gap: 7,
      maxHeight: "82%", overflowY: "auto", padding: 3,
      // 竖向滚动条在这条窄栏里很难看，交互上也不需要
      scrollbarWidth: "none",
    }}
  >
    {items.map((it, i) => {
      const on = i === activeIdx;
      return (
        <button
          key={`${it.label}-${i}`}
          type="button"
          onClick={() => onPick(i)}
          aria-pressed={on}
          aria-label={it.label}
          title={it.label}
          style={{
            flex: "0 0 auto", width: 42, height: 42, padding: 0, borderRadius: 3, cursor: "pointer",
            overflow: "hidden", background: "rgba(255,255,255,.92)",
            border: on ? "2px solid var(--ink)" : "1px solid var(--line-2)",
            boxShadow: on ? "0 2px 10px rgba(0,0,0,.16)" : "0 1px 4px rgba(0,0,0,.08)",
            transition: "border-color .15s, box-shadow .15s",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={it.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </button>
      );
    })}
  </div>
);

// ── Roll 01 · 首屏 ──────────────────────────────────────────

const Hero: React.FC<{
  card: CardProfile;
  phone?: CardContact;
  hasWechat: boolean;
  onSave: () => void;
  onWechat: () => void;
}> = ({ card, phone, hasWechat, onSave, onWechat }) => {
  const [l1, l2] = card.headline.split("\n");

  // 衣柜 = 定妆主图 + 工作台跑出来的每套装扮 / 每个表情。
  // 服务端解析不出来的那几件已经在出 wire 时被摘掉了，这里拿到的都是能显示的。
  const wardrobe = React.useMemo<Array<{ label: string; url: string }>>(() => {
    const looks = (card.figure.looks ?? []).filter((l) => l.imageUrl);
    const out: Array<{ label: string; url: string }> = [];
    if (card.figure.imageUrl) out.push({ label: "定妆", url: card.figure.imageUrl });
    for (const l of looks) {
      // 主图本来就取自某套造型时，别在条上重复出现同一张
      if (l.imageUrl === card.figure.imageUrl) continue;
      out.push({ label: l.label || "造型", url: l.imageUrl });
    }
    return out;
  }, [card.figure]);

  const [lookIdx, setLookIdx] = useState(0);
  // 换了名片（或衣柜变短）时把选中项拉回第一件，避免越界拿到 undefined
  useEffect(() => { setLookIdx(0); }, [wardrobe]);

  const active = wardrobe[lookIdx] ?? wardrobe[0];
  const heroUrl = active?.url ?? card.figure.imageUrl;

  // 首页资源选了视频：进页面自动播一遍，播完给「重播」。
  // 服务端解析不出成片时已经把 tier 打回 static 了，所以这里只需再确认一次地址在。
  const motionUrl = card.figure.tier === "motion" ? card.figure.videoUrl : undefined;
  // 视频播不了就退回静态主图 —— 名片是对外的门面，宁可少一个动效，不能空一块。
  const [motionBroken, setMotionBroken] = useState(false);
  const showMotion = Boolean(motionUrl) && !motionBroken;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [motionEnded, setMotionEnded] = useState(false);
  useEffect(() => { setMotionBroken(false); setMotionEnded(false); }, [motionUrl]);
  const replay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = 0;
    setMotionEnded(false);
    // 自动播被浏览器拦下时 play() 会 reject —— 这是用户手动点的，正常都会通过；
    // 真失败了就退回静态图，不留一个点了没反应的按钮。
    void v.play().catch(() => setMotionBroken(true));
  }, []);
  const heroAlt = active && wardrobe.length > 1
    ? `${card.name}的数字人形象 · ${active.label}`
    : `${card.name}的数字人形象`;

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        background: ROLL.paper,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Cove />

      <div style={{ position: "relative", zIndex: 6, display: "flex", alignItems: "center", gap: 9, padding: "calc(env(safe-area-inset-top, 0px) + 18px) 18px 0" }}>
        <span aria-hidden style={{ width: 6, height: 6, background: "var(--primary)", flex: "0 0 6px" }} />
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <Mono color="var(--ink-2)">{`${card.name} · ${card.company.name} · ${card.city}`}</Mono>
        </span>
        <Mono>Roll 01</Mono>
      </div>

      {/* 巨号字标是刊头，不压在人身上 */}
      <div
        style={{
          position: "relative",
          zIndex: 6,
          padding: "clamp(8px,1.7vh,14px) 18px 0",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
        aria-label={card.latin}
      >
        {card.latin.split("").map((ch, i) => (
          <span
            key={`${ch}-${i}`}
            aria-hidden
            style={{
              fontFamily: DISP,
              fontWeight: 800,
              fontSize: "clamp(38px,15.2vw,70px)",
              lineHeight: 0.78,
              letterSpacing: ".005em",
              color: "var(--ink)",
            }}
          >
            {ch}
          </span>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 6, padding: "clamp(8px,1.5vh,12px) 18px 0", display: "flex", alignItems: "stretch", gap: 14 }}>
        <span aria-hidden style={{ flex: "0 0 2px", background: "var(--primary)" }} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 9 }}>
          <h1 style={{ fontSize: "clamp(19px,5.8vw,25px)", fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1.32, margin: 0 }}>
            {l1}
            {l2 && <><br />{l2}</>}
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <OfferLine label="能提供" text={card.offer.give[0]} />
            <OfferLine label="在找" text={card.offer.want[0]} accent />
          </div>
        </div>
      </div>

      {/* 形象：底部溶解，不用径向遮罩（会吃掉帽顶） */}
      <div style={{ flex: "1 1 auto", minHeight: 0, position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: -150,
            height: "calc(100% + 150px)",
            width: 340,
            maxWidth: "90vw",
            background: ROLL.paper,
            WebkitMaskImage: "linear-gradient(to bottom,#000 0%,#000 76%,rgba(0,0,0,0) 100%)",
            maskImage: "linear-gradient(to bottom,#000 0%,#000 76%,rgba(0,0,0,0) 100%)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {showMotion ? (
            <video
              ref={videoRef}
              src={motionUrl}
              poster={card.figure.posterUrl || heroUrl}
              // muted 是自动播的前提：移动端浏览器一律不给带声音的视频自动播。
              // 不 loop —— 用户要的是「进来播一遍」，循环播放在名片上很吵。
              autoPlay
              muted
              playsInline
              preload="metadata"
              onEnded={() => setMotionEnded(true)}
              onError={() => setMotionBroken(true)}
              aria-label={`${card.name}的动态形象`}
              style={{ height: "calc(100% - 16px)", width: "auto", display: "block", objectFit: "contain" }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={heroUrl}
              alt={heroAlt}
              style={{ height: "calc(100% - 16px)", width: "auto", display: "block" }}
            />
          )}
        </div>

        {/* 播完给一个重播 —— 只在真播完之后出现，播放中不压在画面上 */}
        {showMotion && motionEnded && (
          <button
            type="button"
            onClick={replay}
            style={{
              position: "absolute",
              left: "50%",
              bottom: 18,
              transform: "translateX(-50%)",
              zIndex: 7,
              height: 34,
              padding: "0 16px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: "rgba(255,255,255,.92)",
              backdropFilter: "blur(10px)",
              fontSize: 12.5,
              fontWeight: 700,
              color: "var(--ink-1)",
              cursor: "pointer",
            }}
          >
            ↺ 重播
          </button>
        )}

        {/* 换装条：工作台跑出来的装扮与表情，访客点着看。
            首页放视频时不渲染 —— 那条切换的是静态图，跟正在播的视频对不上。 */}
        {!showMotion && wardrobe.length > 1 && (
          <Wardrobe items={wardrobe} activeIdx={lookIdx} onPick={setLookIdx} />
        )}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 6,
          margin: "0 14px clamp(6px,1.2vh,10px)",
          background: "rgba(255,255,255,.9)",
          backdropFilter: "blur(14px)",
          border: "1px solid var(--line)",
          borderRadius: 2,
          padding: "clamp(8px,1.3vh,11px) 14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11, paddingBottom: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 16, fontWeight: 800, letterSpacing: "-.01em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {card.name}
          </span>
          <Mono>{card.regNo}</Mono>
        </div>
        <InfoRow label="职位" value={card.title} />
        {phone && <InfoRow label="电话" value={phone.value} mono />}
      </div>

      <div style={{ position: "relative", zIndex: 6, padding: "0 14px calc(env(safe-area-inset-bottom, 0px) + clamp(12px,2.2vh,20px))", display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onWechat}
          style={{
            flex: "0 0 94px",
            height: "clamp(42px,5.4vh,46px)",
            borderRadius: 2,
            border: "1px solid rgba(20,32,43,.26)",
            background: "rgba(255,255,255,.9)",
            color: "var(--ink)",
            fontFamily: "inherit",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {hasWechat ? "加微信" : "复制信息"}
        </button>
        <button
          type="button"
          onClick={onSave}
          style={{
            flex: 1,
            minWidth: 0,
            height: "clamp(42px,5.4vh,46px)",
            borderRadius: 2,
            border: "none",
            background: "var(--ink)",
            color: "#fff",
            fontFamily: "inherit",
            fontSize: 14.5,
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          存到通讯录
        </button>
      </div>
    </section>
  );
};

const OfferLine: React.FC<{ label: string; text?: string; accent?: boolean }> = ({ label, text, accent }) =>
  text ? (
    <span style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
      <span style={{ flex: "0 0 38px" }}>
        <Mono color={accent ? "var(--primary)" : "var(--ink-3)"}>{label}</Mono>
      </span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {text}
      </span>
    </span>
  ) : null;

const InfoRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div style={{ display: "flex", gap: 12, padding: "clamp(5px,.9vh,7px) 0", borderTop: "1px solid var(--line)" }}>
    <span style={{ flex: "0 0 38px" }}>
      <Mono>{label}</Mono>
    </span>
    <span
      className={mono ? "mono" : undefined}
      style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: mono ? 500 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
    >
      {value}
    </span>
  </div>
);

// ── Roll 02 · 我在做的事 ────────────────────────────────────

const Works: React.FC<{ card: CardProfile }> = ({ card }) => (
  <section style={{ position: "relative", overflow: "hidden", background: ROLL.mist, padding: "30px 18px 26px" }}>
    <Cove />
    <div style={{ position: "relative", zIndex: 2 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden style={{ width: 6, height: 6, background: "var(--primary)", flex: "0 0 6px" }} />
            <Mono color="rgba(20,32,43,.6)">Roll 02 · 青雾</Mono>
          </div>
          <h2 style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-.035em", lineHeight: .98, margin: 0 }}>
            我在<br />做的事
          </h2>
        </div>
        <div style={{ flex: "0 0 126px", marginTop: -6, background: "#fff", border: "1px solid rgba(20,32,43,.12)", boxShadow: "0 18px 40px rgba(20,32,43,.14)", padding: "8px 8px 0" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/card/demo-works.jpg" alt={`${card.name}的数字人形象 · 抱臂`} style={{ width: "100%", height: "auto", display: "block" }} />
          <div style={{ padding: "7px 2px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <Mono style={{ flex: 1, minWidth: 0 }}>{card.avatarRegNo}</Mono>
          </div>
        </div>
      </div>

      <p style={{ fontSize: 13, lineHeight: 1.7, color: "rgba(20,32,43,.68)", margin: "12px 0 0" }}>
        {card.company.intro}
      </p>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 12 }}>
        {/* key 用下标而不是 w.no：编号是用户可编辑的，可能重复（历史数据里就有） */}
        {card.works.map((w, i) => (
          <div key={`${w.no}-${i}`} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderTop: "1px solid rgba(20,32,43,.14)" }}>
            <span style={{ flex: "0 0 18px" }}>
              <Mono color="rgba(20,32,43,.42)">{w.no}</Mono>
            </span>
            <span aria-hidden style={{ flex: "0 0 30px", height: 30, borderRadius: 4, background: w.tone, border: "1px solid rgba(20,32,43,.10)" }} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.title}</span>
              <span style={{ fontSize: 11.5, color: "rgba(20,32,43,.58)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.desc}</span>
            </span>
          </div>
        ))}
      </div>

      {/* 人设 —— 名片上唯一讲「他是谁」的一段（其余都在讲他做过什么）。
          没聊过就整段不渲染：宁可少一段，也不要一块写着「暂无」的空壳。 */}
      <PersonaBand persona={card.persona} />

      <div aria-hidden style={{ height: 1, background: "rgba(20,32,43,.16)", margin: "22px 0 18px" }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Mono color="rgba(20,32,43,.6)">想找什么样的合作</Mono>
        <OfferBlock title="我能提供" items={card.offer.give} tone="var(--primary)" />
        <OfferBlock title="我在找" items={card.offer.want} tone="var(--ink)" />
      </div>
    </div>
  </section>
);

/**
 * 「关于我」——价值观 + 性格 + 一句话人设。
 *
 * 放在作品之后、合作诉求之前：先看他做过什么（可信），再看他是个什么人（可亲），
 * 最后才谈合作。三段的顺序就是一次见面自然的顺序。
 *
 * 说话方式（voice）不在这里露出 —— 那是给改写用的规格，不是给访客看的内容。
 */
const PersonaBand: React.FC<{ persona?: CardProfile["persona"] }> = ({ persona }) => {
  if (!persona) return null;
  const { essence, values = [], traits = [] } = persona;
  if (!essence && values.length === 0 && traits.length === 0) return null;
  return (
    <>
      <div aria-hidden style={{ height: 1, background: "rgba(20,32,43,.16)", margin: "22px 0 18px" }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Mono color="rgba(20,32,43,.6)">关于我</Mono>

        {essence && (
          <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 19, lineHeight: 1.6, color: "var(--ink)" }}>
            {essence}
          </p>
        )}

        {traits.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {traits.map((t) => (
              <span
                key={t}
                style={{
                  padding: "5px 11px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                  background: "rgba(20,32,43,.06)", color: "rgba(20,32,43,.72)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {values.length > 0 && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            {values.map((v) => (
              <li key={v} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
                <span aria-hidden style={{ flex: "0 0 14px", height: 1, marginTop: 10, background: "rgba(20,32,43,.32)" }} />
                <span style={{ fontSize: 13.5, lineHeight: 1.75, color: "rgba(20,32,43,.78)" }}>{v}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
};

const OfferBlock: React.FC<{ title: string; items: string[]; tone: string }> = ({ title, items, tone }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
    <span style={{ fontSize: 13.5, fontWeight: 800 }}>{title}</span>
    {items.map((t) => (
      <div key={t} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span aria-hidden style={{ width: 5, height: 5, background: tone, flex: "0 0 5px", marginTop: 8 }} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: 1.65 }}>{t}</span>
      </div>
    ))}
  </div>
);

// ── Roll 03 · 这家公司 ──────────────────────────────────────

const MEDIA_ICON: Record<string, React.ReactNode> = {
  video: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M10 8.5l6 3.5-6 3.5z" />
    </svg>
  ),
  article: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="16" height="18" rx="2" /><line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="12" y2="16" />
    </svg>
  ),
  doc: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2.5h9l4.5 4.5v14a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 6 2.5z" /><polyline points="14.5,2.5 14.5,7.5 19.5,7.5" />
    </svg>
  ),
};

const Company: React.FC<{ card: CardProfile }> = ({ card }) => (
  <section style={{ position: "relative", overflow: "hidden", background: "#F7F9FB", padding: "8px 18px 30px" }}>
    <Cove />
    <div style={{ position: "relative", zIndex: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <span aria-hidden style={{ width: 44, height: 44, background: "#fff", border: "1px solid var(--line-2)", display: "grid", placeItems: "center", flex: "0 0 44px", fontFamily: DISP, fontWeight: 800, fontSize: 22 }}>
          {card.company.name.slice(0, 1)}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.company.name}</span>
          <Mono style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.company.meta}</Mono>
        </span>
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
        {card.company.stats.map((s) => (
          <div key={s.label} style={{ flex: 1, minWidth: 0, borderTop: `2px solid ${s.accent ? "var(--primary)" : "var(--ink)"}`, paddingTop: 9, display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontFamily: DISP, fontWeight: 800, fontSize: 40, lineHeight: .82, color: s.accent ? "var(--primary)" : "var(--ink)" }}>{s.value}</span>
            <Mono>{s.label}</Mono>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <Mono>发展历程</Mono>
        {card.company.milestones.map((m, i) => (
          <div key={m.year} style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: "0 0 8px", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 6 }}>
              <span aria-hidden style={{ width: 7, height: 7, background: m.current ? "var(--primary)" : "var(--ink-4)", flex: "0 0 7px" }} />
              {i < card.company.milestones.length - 1 && <span aria-hidden style={{ width: 1, flex: 1, background: "var(--line)", minHeight: 18 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 13, display: "flex", flexDirection: "column", gap: 3 }}>
              <Mono color={m.current ? "var(--primary)" : "var(--ink-4)"}>{m.year}</Mono>
              <span style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>{m.text}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 11 }}>
        <Mono>宣传与报道</Mono>
        <div style={{ display: "flex", gap: 10, overflowX: "auto", margin: "0 -18px", padding: "0 18px", scrollbarWidth: "none" }}>
          {card.media.map((m) => (
            <div key={m.title} style={{ flex: "0 0 158px", border: "1px solid var(--line)", background: "#fff", overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ height: 96, background: "var(--surface-3)", display: "grid", placeItems: "center", color: "var(--ink-3)" }}>{MEDIA_ICON[m.kind]}</div>
              <div style={{ padding: "9px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.title}</span>
                <Mono color="var(--ink-4)">{m.meta}</Mono>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <Mono>成长履历</Mono>
          <span style={{ marginLeft: "auto" }}><Mono color="var(--ink-4)">本人确认公开</Mono></span>
        </div>
        {card.resume.map((r) => (
          <div key={r.title} style={{ borderTop: "1px solid var(--line)", padding: "11px 0", display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
            <span style={{ flex: "0 0 auto" }}><Mono>{r.period}</Mono></span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── Roll 04 · 找我聊聊 ──────────────────────────────────────

const ABOUT = [
  { title: "内容出自 AI 军师的战略诊断", sub: "企业诊断的结论，直接用作名片内容" },
  { title: "形象是登记在册的数字人资产", sub: "真人复刻 · 本人授权" },
  { title: "开屏那段由 AI 生成", sub: "文案更新后自动重新生成" },
];

const Contact: React.FC<{
  card: CardProfile;
  shown: CardContact[];
  onCopy: (label: string, value: string) => void;
  onSave: () => void;
}> = ({ card, shown, onCopy, onSave }) => (
  <section style={{ position: "relative", overflow: "hidden", background: ROLL.slate, padding: "8px 18px calc(env(safe-area-inset-bottom, 0px) + 30px)" }}>
    <Cove dark />
    <div style={{ position: "relative", zIndex: 2 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span aria-hidden style={{ fontFamily: DISP, fontWeight: 800, fontSize: 58, lineHeight: .82, color: ON_SLATE_3 }}>LET&apos;S TALK</span>
        <h2 style={{ fontSize: 46, fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1, color: ON_SLATE, margin: "-6px 0 0" }}>找我聊聊</h2>
      </div>
      <p style={{ fontSize: 13.5, lineHeight: 1.75, color: ON_SLATE_2, margin: "14px 0 0" }}>
        想聊门店线上化，想找区域代理，或者只是想问问这个数字人怎么做出来的 —— 直接联系我，我自己看。
      </p>

      <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
        {shown.map((c, i) => (
          <div key={c.kind} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i === 0 ? "none" : `1px solid ${LINE_SLATE}`, alignItems: "center" }}>
            <span style={{ flex: "0 0 44px" }}>
              <Mono color={ON_SLATE_3}>{CONTACT_LABEL[c.kind]}</Mono>
            </span>
            <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: ON_SLATE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {c.value}
            </span>
            <button
              type="button"
              onClick={() => onCopy(CONTACT_LABEL[c.kind], c.value)}
              style={{ flex: "0 0 auto", background: "transparent", border: "none", padding: "4px 2px", cursor: "pointer", fontFamily: "inherit" }}
            >
              <Mono color="var(--primary-500)">复制</Mono>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onSave}
        style={{ width: "100%", height: 48, marginTop: 18, borderRadius: 2, border: "none", background: "var(--primary-500)", color: "#06313E", fontFamily: "inherit", fontSize: 14.5, fontWeight: 800, cursor: "pointer" }}
      >
        存到通讯录
      </button>

      <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ paddingBottom: 6 }}><Mono color={ON_SLATE_3}>关于这张名片</Mono></span>
        {ABOUT.map((a) => (
          <div key={a.title} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderTop: `1px solid ${LINE_SLATE}` }}>
            <span aria-hidden style={{ width: 6, height: 6, background: "var(--primary-500)", flex: "0 0 6px" }} />
            <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: ON_SLATE, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</span>
              <span style={{ fontSize: 11.5, color: ON_SLATE_3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.sub}</span>
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, marginTop: 26 }}>
        <Mono color={ON_SLATE_3}>{`REG · ${card.regNo} · ${formatDateTime(card.updatedAt)}`}</Mono>
        <Mono color={ON_SLATE_3}>形象为本人授权数字人 · 内容由本人确认</Mono>
        {card.demo && <span style={{ marginTop: 6 }}><Mono color="var(--primary-500)">演示数据</Mono></span>}
      </div>
    </div>
  </section>
);

// ── 微信内的兜底面板 ────────────────────────────────────────

const ContactSheet: React.FC<{
  card: CardProfile;
  shown: CardContact[];
  onCopy: (label: string, value: string) => void;
  onClose: () => void;
}> = ({ card, shown, onCopy, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`${card.name}的联系方式`} style={{ position: "fixed", inset: 0, zIndex: 95 }}>
      <button
        type="button"
        aria-label="关闭"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(20,40,60,.44)", border: "none", padding: 0, cursor: "pointer" }}
      />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "var(--surface)", borderRadius: "18px 18px 0 0", boxShadow: "var(--sh-3)", padding: "9px 18px calc(env(safe-area-inset-bottom, 0px) + 20px)" }}>
        <span aria-hidden style={{ display: "block", width: 38, height: 4, borderRadius: 99, background: "var(--line-3)", margin: "0 auto 12px" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 }}>
          <span style={{ fontSize: 17, fontWeight: 800 }}>存下 {card.name}</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.6, color: "var(--ink-2)" }}>
            微信里存不进系统通讯录。逐条复制，或右上角用浏览器打开再存。
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {shown.map((c, i) => (
            <div key={c.kind} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
              <span style={{ flex: "0 0 40px" }}><Mono>{CONTACT_LABEL[c.kind]}</Mono></span>
              <span className="mono" style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.value}</span>
              <button
                type="button"
                onClick={() => onCopy(CONTACT_LABEL[c.kind], c.value)}
                style={{ flex: "0 0 auto", height: 30, padding: "0 12px", borderRadius: 2, border: "1px solid var(--line-2)", background: "var(--surface-2)", color: "var(--ink)", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
              >
                复制
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{ width: "100%", height: 46, marginTop: 14, borderRadius: 2, border: "1px solid var(--line-2)", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
        >
          知道了
        </button>
      </div>
    </div>
  );
};
