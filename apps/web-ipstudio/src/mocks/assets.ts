// 数字资产 / 名片的 mock 样本 —— USE_MOCK=1 下工作台照样能走完「发布 → 看资产 → 看名片」。
//
// 样本刻意覆盖三种真实状态：已发布并挂了名片的形象、还没做名片的形象、
// 以及一张草稿名片。只放「都正常」的样本，空态和草稿态的界面就永远没人看过。
//
// 图一律留空：仓库自 v0.152 起不放图片二进制（真源在 OSS），而且 mock 走占位
// 正好把「还没出图」这条渲染路径练到 —— 真实数据里它一定会出现。

import type {
  AssetSummary, CardSummary, DapAvatar, DapDerivative, DapLook,
} from "@/lib/asset-types";

export const MOCK_AVATARS: DapAvatar[] = [
  {
    id: "DH-2041", name: "林一", codename: "LIN-YI", path: "ai", archetype: "潮玩少年",
    tagline: "一个你，不止一种想象", status: "finalized", updated: "2 小时前", fav: true,
    license: null, engine: "agnes-image", versions: 3, imageUrl: null,
    variantImages: [], ipId: null,
  },
  {
    id: "DH-2044", name: "苏禾", codename: "SU-HE", path: "ai", archetype: "商务通勤",
    tagline: "把专业穿在身上", status: "finalized", updated: "昨天", fav: false,
    license: null, engine: "agnes-image", versions: 1, imageUrl: null,
    variantImages: [], ipId: null,
  },
  // 刻意留一个**没有名片**的形象：「还没做成名片」那条空态是名片建卡的唯一入口，
  // 如果每个样例形象都已经有卡，这条路径在 mock 里就永远走不到（真踩过）。
  {
    id: "DH-2052", name: "阿岚", codename: "A-LAN", path: "ai", archetype: "潮玩少女",
    tagline: "还没做过名片的那个", status: "finalized", updated: "3 天前", fav: false,
    license: null, engine: "agnes-image", versions: 2, imageUrl: null,
    variantImages: [], ipId: null,
  },
];

export const MOCK_LOOKS: Record<string, DapLook[]> = {
  "DH-2041": [
    { id: "LK-8801", avatarId: "DH-2041", label: "日常潮玩装", source: "design", status: "ready", imageUrl: null, createdAt: "2026-09-07T02:10:00Z" },
    { id: "LK-8802", avatarId: "DH-2041", label: "商务通勤装", source: "design", status: "ready", imageUrl: null, createdAt: "2026-09-07T02:12:00Z" },
    { id: "LK-8803", avatarId: "DH-2041", label: "表情 · 开心大笑", source: "design", status: "ready", imageUrl: null, createdAt: "2026-09-07T02:14:00Z" },
  ],
  "DH-2044": [
    { id: "LK-8811", avatarId: "DH-2044", label: "商务通勤装", source: "design", status: "ready", imageUrl: null, createdAt: "2026-09-06T09:00:00Z" },
  ],
};

MOCK_LOOKS["DH-2052"] = [
  { id: "LK-8821", avatarId: "DH-2052", label: "日常潮玩装", source: "design", status: "ready", imageUrl: null, createdAt: "2026-09-04T09:00:00Z" },
  { id: "LK-8822", avatarId: "DH-2052", label: "表情 · 惊讶", source: "design", status: "ready", imageUrl: null, createdAt: "2026-09-04T09:02:00Z" },
];

export const MOCK_DERIVATIVES: Record<string, DapDerivative[]> = {
  "DH-2041": [
    { id: "DV-501", avatarId: "DH-2041", key: "video", idx: 0, kind: "video", label: "打招呼挥手", spec: "2s · 循环", thumbUrl: null, createdAt: "2026-09-07T03:00:00Z" },
  ],
  "DH-2044": [],
  "DH-2052": [],
};

export const MOCK_CARDS: CardSummary[] = [
  {
    id: "CARD-demo", slug: "demo", regNo: "BC-2041", status: "published", avatarId: "DH-2041",
    publicUrl: "/card/p/demo", publishedAt: "2026-09-07T04:00:00Z", updatedAt: "2026-09-07T04:00:00Z",
  },
  {
    id: "CARD-draft", slug: "su-he", regNo: "BC-2044", status: "draft", avatarId: "DH-2044",
    publicUrl: "/card/p/su-he", publishedAt: null, updatedAt: "2026-09-06T10:00:00Z",
  },
];

export const MOCK_ASSET_SUMMARY: AssetSummary = {
  totalCount: 9, totalBytes: 184_320_000, totalSizeLabel: "176 MB",
  types: [
    { key: "character", label: "人物", prefix: "DH", count: 3 },
    { key: "ip", label: "品牌 IP", prefix: "IP", count: 0 },
    { key: "scene", label: "场景", prefix: "SC", count: 3 },
    { key: "product", label: "产品", prefix: "PD", count: 0 },
    { key: "voice", label: "声音", prefix: "VO", count: 1 },
    { key: "style", label: "风格", prefix: "ST", count: 3 },
  ],
  recent: [],
};
