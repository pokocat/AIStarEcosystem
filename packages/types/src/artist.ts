// ─────────────────────────────────────────────────────────────────────────────
// artist.ts — 艺人（虚拟 IP）核心领域模型。
// 以前端设计为唯一事实源（Figma：AI 艺人孵化操作系统 v3）。
// 与 apps/web/src/types/contracts/singers.ts 的差异：本平台把 Singer 归为
// Artist 的一种子类型（ArtistType = "singer"），故本模型比 SingerDetail 更宽。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime, Rarity } from "./_shared";

// ── 艺人分类（7 类） ──────────────────────────────────────────────────────────
export type ArtistType =
  | "singer"
  | "actor"
  | "entertainer"
  | "dancer"
  | "host"
  | "all_rounder"
  | "idol";

/** 艺人品质 = 通用稀有度。别名便于业务侧阅读。 */
export type ArtistQuality = Rarity;

/** 艺人生命周期状态 */
export type ArtistStatus = "trainee" | "debut" | "active" | "rest" | "retired";

// ── 六维才艺 ──────────────────────────────────────────────────────────────────
export interface TalentProfile {
  singing: number;  // 声乐
  acting: number;   // 演技
  dancing: number;  // 舞蹈
  hosting: number;  // 主持
  comedy: number;   // 喜剧
  variety: number;  // 综艺
}

export type TalentKey = keyof TalentProfile;

// ── 艺人业务统计 ──────────────────────────────────────────────────────────────
// 数值字段全部按 product_spec.md §3.1 存原始整型，展示侧由 lib/format.ts 处理。
export interface ArtistStats {
  songs: number;                 // 已发行歌曲数
  dramas: number;                // 已参演剧集数
  ads: number;                   // 已接广告数
  variety: number;               // 综艺上节数
  /** 粉丝数（原始整数）。展示请用 formatCompactNumber()。 */
  fans: number;
  /** 总收益（积分原始值）。展示请用 formatCredits()。 */
  revenue: number;
  /** 月度收益（积分原始值） */
  monthlyRevenue: number;
  /** 人气值 0–100 */
  popularity: number;
}

// ── 艺人（核心实体） ──────────────────────────────────────────────────────────
export interface Artist {
  id: ID;
  name: string;
  type: ArtistType;
  quality: ArtistQuality;
  status: ArtistStatus;
  level: number;
  exp: number;
  maxExp: number;
  avatar: string;                // 头像 URL
  talents: TalentProfile;
  stats: ArtistStats;
  createdAt: ISODateTime;
  lastActive: ISODateTime;
  bio: string;
  /** 艺人主营领域 ID 列表（见 constants/domains-8.ts） */
  domains: string[];
  /** 商业代言数（个） */
  endorsements: number;
  /** 商业价值（credits 原始值）。展示请用 formatCredits()。 */
  commercialValue: number;
  /** 所属工作室 ID（1:N，艺人必属 Studio） */
  studioId: ID;
  /** 所属工作室名（便利字段，由 admin/me 端 enrich 填充，可选） */
  studioName?: string;
  /** 拥有者账户 ID */
  ownerUserId: ID;
  /** 最后更新时间 */
  updatedAt?: ISODateTime;
  /**
   * 孵化 / 设定参数 —— 自由键值对。
   * 由孵化向导产出（如 faceStyle / fashionStyle / age / height /
   * sweetness / energy / mystery / confidence / extraPersona 等）。
   * 存在于后端 JSON 列 digital_ips.incubation_params，字段可随业务演进新增。
   */
  incubationParams?: Record<string, unknown>;
  /**
   * 艺人当前"官方形象" = appearance-forge `ForgeResult.id`。
   * 用于艺人详情页 Hero 主图、分发物料默认封面、商业授权主形象。
   * 为空时详情页回落到 `avatar`。
   * @deprecated v0.60 收敛后形象统一来自 AiAvatar（见 dapAvatarId），仅遗留艺人仍读此字段。
   */
  officialAppearanceId?: ID;

  // ── AiAvatar 数字人引用（v0.60 收敛：艺人形象统一来自 AiAvatar）──────────────
  /** 引用的数字人 id（经「引入数字人」创建的艺人必有；遗留孵化艺人为 null） */
  dapAvatarId?: ID | null;
  /** 首要展示图指针：null=跟随数字人定妆照；"look:<id>" / "deriv:<id>" 指向具体资产 */
  dapDisplayRef?: string | null;
  /** 数字人当前名称（server 实时派生；数字人被删/回收站时为 null） */
  dapAvatarName?: string | null;
  /** 首要展示图签名 URL（server 实时派生 + 自动回退定妆照；不可用时为 null） */
  dapDisplayImageUrl?: string | null;
}

// ── 引入数字人请求（POST /me/digital-ips/import-avatar）──────────────────────
export interface ImportAvatarRequest {
  /** 要引入的数字人 id（必填，须本人所有且已有定妆照） */
  dapAvatarId: ID;
  /** 艺人类型（music 端默认 singer，drama 端默认 actor） */
  type?: ArtistType;
  /** 艺名（缺省 = 数字人名称） */
  name?: string;
  /** 首要展示图指针（缺省 = 跟随定妆照） */
  dapDisplayRef?: string | null;
  bio?: string;
}
