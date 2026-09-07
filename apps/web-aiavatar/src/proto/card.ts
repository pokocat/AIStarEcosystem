// ============================================================
// AI 数字名片 —— 类型契约 + Mock 数据 + 读取入口。
//
// 方案真源：docs/digital-business-card-plan.md
// 名片是「个人 / 企业 IP 的对外发布面」，不产生任何新资产 ——
// 形象一律以 dapDisplayRef 引用数字资产（look:<id> / deriv:<id> /
// null=跟随定妆照），改了资产名片自动跟着变，永不拷贝图片。
//
// 一期只做展示：扫码即看（无需登录）/ 形象三档 / 存进通讯录。
// 交换名片、名片夹、字段分层可见挂二期。
// ============================================================
import { USE_MOCK } from "@/proto/api";

// ── 类型 ────────────────────────────────────────────────────

/** 形象三档。三档都是完整形态，从最低一档就能把名片发出去。 */
export type CardFigureTier = "static" | "motion" | "voice";

export interface CardFigure {
  tier: CardFigureTier;
  /** dapDisplayRef —— 名片存的是引用，不是图。null = 跟随数字人定妆照。 */
  ref: string | null;
  /** 出 wire 时由 CdnUrlSigner 派生的签名地址；文档里只存 cdnKey。 */
  imageUrl: string;
  /** tier=motion：1–3 秒透明 WebP 循环微动。 */
  motionUrl?: string;
  /** tier=voice：口播成片。 */
  videoUrl?: string;
  durationSec?: number;
}

export type CardContactKind = "phone" | "wechat" | "email" | "address";

export interface CardContact {
  kind: CardContactKind;
  value: string;
  /** false = 主人选了「不放」，不出现在名片上（一期只有放 / 不放两态）。 */
  shown: boolean;
}

export interface CardWorkItem {
  no: string;
  title: string;
  desc: string;
  /** 条目左侧的色块，纯视觉。 */
  tone: string;
}

export interface CardMilestone {
  year: string;
  text: string;
  current?: boolean;
}

export interface CardStat {
  value: string;
  label: string;
  accent?: boolean;
}

export interface CardCompany {
  name: string;
  meta: string;
  intro: string;
  stats: CardStat[];
  milestones: CardMilestone[];
}

export type CardMediaKind = "video" | "article" | "doc";

export interface CardMedia {
  kind: CardMediaKind;
  title: string;
  meta: string;
}

export interface CardResumeItem {
  title: string;
  period: string;
}

export interface CardProfile {
  slug: string;
  /** 名片登记号。 */
  regNo: string;
  name: string;
  /** 字标用的拉丁名，全大写。 */
  latin: string;
  headline: string;
  title: string;
  city: string;
  /** 形象所属的数字人资产编号。 */
  avatarRegNo: string;
  figure: CardFigure;
  offer: { give: string[]; want: string[] };
  works: CardWorkItem[];
  company: CardCompany;
  media: CardMedia[];
  resume: CardResumeItem[];
  contacts: CardContact[];
  updatedAt: string;
  /** true = 演示数据，界面必须显式标注，不冒充真实名片。 */
  demo?: boolean;
}

// ── Mock ────────────────────────────────────────────────────

const DEMO: CardProfile = {
  slug: "bc2041",
  regNo: "BC-2041",
  name: "冰峰",
  latin: "BINGFENG",
  headline: "帮连锁品牌\n把门店生意做到线上",
  title: "路博星科技 · 创始人兼 CEO",
  city: "南京",
  avatarRegNo: "DH-2041",
  figure: {
    tier: "static",
    ref: "look:LK-2041-a",
    imageUrl: "/card/demo-static.jpg",
  },
  offer: {
    give: [
      "数字人矩阵搭建 + 短视频投流，按月结算",
      "门店线上化改造，从选品到直播间一整套",
      "创始人个人 IP 长期顾问，含形象与内容排期",
    ],
    want: [
      "20 家店以上的连锁餐饮、美业品牌",
      "华东华南的区域代理伙伴，有本地商家资源优先",
    ],
  },
  works: [
    { no: "01", title: "连锁餐饮 · 门店线上化", desc: "20+ 门店品牌，一整套落地", tone: "#1D2A38" },
    { no: "02", title: "数字人矩阵代运营", desc: "按月结算，账号 300 余个", tone: "#FFFFFF" },
    { no: "03", title: "短视频投流 · 起量复盘", desc: "每周对账，不起量不收下一期", tone: "#14202B" },
    { no: "04", title: "企业宣传片 · 1:42", desc: "工坊出品，可直接投放", tone: "#12B3DE" },
    { no: "05", title: "36 氪专访", desc: "连锁品牌的 AI 内容账怎么算", tone: "#0C97BE" },
  ],
  company: {
    name: "路博星科技",
    meta: "2019 · 南京 · 46 人",
    intro: "为线下连锁品牌提供 AI 内容服务。自研数字人矩阵工具，已服务 40 余个品牌，代运营账号 300 余个。",
    stats: [
      { value: "46", label: "团队" },
      { value: "40+", label: "服务品牌" },
      { value: "300", label: "代运营账号", accent: true },
    ],
    milestones: [
      { year: "2026", text: "数字人矩阵工具对外开放，服务品牌超 40 家", current: true },
      { year: "2023", text: "拿到 A 轮，团队扩到 46 人" },
      { year: "2019", text: "在南京成立，团队 3 人" },
    ],
  },
  media: [
    { kind: "video", title: "企业宣传片 · 门店生意如何做到线上", meta: "2026-07 · 1:42" },
    { kind: "article", title: "36 氪专访：连锁品牌的 AI 内容账怎么算", meta: "2026-05 · 图文" },
    { kind: "doc", title: "品牌合作手册 · 2026 版", meta: "2026-03 · PDF" },
  ],
  resume: [
    { title: "清华大学 EMBA", period: "2022–2024" },
    { title: "阿里巴巴 · 本地生活高级运营专家", period: "2016–2019" },
    { title: "武汉理工大学 MBA", period: "2014–2016" },
  ],
  contacts: [
    { kind: "phone", value: "138 0013 8000", shown: true },
    { kind: "wechat", value: "binfeng_lub", shown: true },
    { kind: "email", value: "df@lubstar.com.cn", shown: true },
    { kind: "address", value: "江苏 · 南京 · 建邺区", shown: true },
  ],
  updatedAt: "2026-09-06",
  demo: true,
};

// ── 读取 ────────────────────────────────────────────────────

/**
 * 按短链取名片。公开读，不需要登录 ——
 * server 侧对应 GET /api/v1/card/p/{slug}，须登记进 ProductRouteTable.PUBLIC_GETS。
 */
export async function fetchCard(slug: string): Promise<CardProfile | null> {
  if (USE_MOCK) {
    await new Promise((r) => setTimeout(r, 120));
    return slug === DEMO.slug ? DEMO : null;
  }
  const res = await fetch(`/api/v1/card/p/${encodeURIComponent(slug)}`, {
    headers: { Accept: "application/json" },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`名片读取失败（${res.status}）`);
  const body = await res.json();
  return (body?.data ?? body) as CardProfile;
}

export const CardApi = { bySlug: fetchCard };

/** 演示名片的短链，首页/开发入口用。 */
export const DEMO_CARD_SLUG = DEMO.slug;

// ── vCard ───────────────────────────────────────────────────

const VCARD_FIELD: Record<CardContactKind, (v: string) => string | null> = {
  phone: (v) => `TEL;TYPE=CELL:${v.replace(/\s+/g, "")}`,
  email: (v) => `EMAIL;TYPE=INTERNET:${v}`,
  address: (v) => `ADR;TYPE=WORK:;;${v.replace(/\s*·\s*/g, " ")};;;;`,
  // 微信没有标准 vCard 字段，写进备注，免得静默丢掉。
  wechat: () => null,
};

/** 生成 vCard 3.0 文本。只收 shown=true 的联系方式。 */
export function buildVCard(card: CardProfile): string {
  const shown = card.contacts.filter((c) => c.shown);
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${card.name};;;;`,
    `FN:${card.name}`,
    `ORG:${card.company.name}`,
    `TITLE:${card.title}`,
  ];
  for (const c of shown) {
    const line = VCARD_FIELD[c.kind](c.value);
    if (line) lines.push(line);
  }
  const wechat = shown.find((c) => c.kind === "wechat");
  const note = [wechat ? `微信：${wechat.value}` : null, card.headline.replace(/\n/g, " ")]
    .filter(Boolean)
    .join(" / ");
  if (note) lines.push(`NOTE:${note}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}
