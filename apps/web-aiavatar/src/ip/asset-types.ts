// ─────────────────────────────────────────────────────────────────────────────
// 数字资产 / 名片 —— 工作台只读视角的精简类型。
//
// 服务端真源是 `DapDtos.AvatarDto` / `LookDto` / `DerivativeDto`、
// `DapAssetDtos.AssetSummaryDto`、`CardController.CardSummary`。
//
// 为什么不照抄 web-aiavatar 的 `proto/data.ts`：那份是移动端 SPA 的完整模型，
// 掺了大量只在 mock 里用得上的字段（调色板、发型、人设档案…）。工作台是**只读展示**，
// 用得着的就这些；抄全量只会让人以为这些字段在这里都有意义。
//
// 字段名必须与服务端 DTO 逐字一致（§4.1）—— 少一个字母就是 undefined，不会报错。
// ─────────────────────────────────────────────────────────────────────────────

/** 数字人形象（`DH-`）。 */
export interface DapAvatar {
  id: string;
  name: string;
  codename: string;
  /** ai = AI 原创；real = 真人复刻（后者要有生效授权才能出片） */
  path: string;
  archetype: string;
  tagline: string;
  status: string;
  /** 服务端已经转成中文相对时间（「2 小时前」），不要再自己格式化 */
  updated: string;
  fav: boolean;
  license?: string | null;
  engine: string;
  versions: number;
  imageUrl?: string | null;
  variantImages?: string[];
  ipId?: string | null;
  mock?: boolean;
}

/** 造型（`LK-`）—— 工作台发布出去的每个形象卡各对应一条。 */
export interface DapLook {
  id: string;
  avatarId: string;
  label: string;
  /** design = 工作台设计稿；其余为 dap 内生成 */
  source: string;
  prompt?: string | null;
  status: string;
  imageUrl?: string | null;
  createdAt?: string | null;
}

/** 衍生物（表情包 / 场景图 / 短动作视频…）。 */
export interface DapDerivative {
  id: string;
  avatarId: string;
  key: string;
  idx: number;
  kind: string;
  fileUrl?: string | null;
  thumbUrl?: string | null;
  label?: string | null;
  spec?: string | null;
  createdAt?: string | null;
}

export interface AssetTypeTile { key: string; label: string; prefix: string; count: number }
export interface RecentAsset {
  kind: string; kindLabel: string; id: string; name: string; when: string; imageUrl?: string | null;
}
export interface AssetSummary {
  totalCount: number;
  totalBytes: number;
  totalSizeLabel: string;
  types: AssetTypeTile[];
  recent: RecentAsset[];
}

/** 名片摘要（`GET /api/v1/card/mine`、`/card/by-avatar/{id}`）。 */
export interface CardSummary {
  id: string;
  slug: string;
  regNo: string;
  status: "draft" | "published";
  avatarId: string | null;
  /** 公开页路径，拼上 aiavatar 站点域名就是可以递出去的链接 */
  publicUrl: string;
  publishedAt: string | null;
  updatedAt: string | null;
}
