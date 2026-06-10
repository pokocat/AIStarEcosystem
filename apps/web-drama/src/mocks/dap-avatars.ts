// ─────────────────────────────────────────────────────────────────────────────
// mocks/dap-avatars.ts — AiAvatar 数字人样本数据（network 拦截层用）。
// 与 api/dap-avatars.ts 的 Lite 类型对齐（dap AvatarDto / LookDto / DerivativeDto 子集）。
// ─────────────────────────────────────────────────────────────────────────────

import type { DapAvatarLite, DapLookLite, DapDerivativeLite } from "@/api/dap-avatars";

export const MOCK_DAP_AVATARS: DapAvatarLite[] = [
  {
    id: "DH-MOCK01",
    name: "凌霄",
    status: "ready",
    imageUrl: "https://images.unsplash.com/photo-1618641986557-1ecd230959aa?w=400&q=80",
  },
  {
    id: "DH-MOCK02",
    name: "苏晚",
    status: "ready",
    imageUrl: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80",
  },
  {
    id: "DH-MOCK03",
    name: "阿凯",
    status: "ready",
    imageUrl: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&q=80",
  },
];

export const MOCK_DAP_LOOKS: DapLookLite[] = [
  {
    id: "LK-MOCK01",
    label: "古装造型",
    status: "done",
    imageUrl: "https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&q=80",
  },
  {
    id: "LK-MOCK02",
    label: "都市日常",
    status: "done",
    imageUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&q=80",
  },
];

export const MOCK_DAP_DERIVS: DapDerivativeLite[] = [
  {
    id: "DRV-MOCK01",
    kind: "scene",
    label: "剧照 · 雨夜街头",
    fileUrl: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&q=80",
    thumbUrl: null,
  },
  {
    id: "DRV-MOCK02",
    kind: "ward",
    label: "戏服look",
    fileUrl: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80",
    thumbUrl: null,
  },
];
