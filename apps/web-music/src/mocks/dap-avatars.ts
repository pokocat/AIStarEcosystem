// ─────────────────────────────────────────────────────────────────────────────
// mocks/dap-avatars.ts — AiAvatar 数字人样本（USE_MOCK=1 时「引入数字人」picker 用）。
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
    label: "舞台造型",
    status: "done",
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80",
  },
  {
    id: "LK-MOCK02",
    label: "休闲日常",
    status: "done",
    imageUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=400&q=80",
  },
];

export const MOCK_DAP_DERIVS: DapDerivativeLite[] = [
  {
    id: "DRV-MOCK01",
    kind: "scene",
    label: "演唱会现场",
    fileUrl: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80",
    thumbUrl: null,
  },
  {
    id: "DRV-MOCK02",
    kind: "ward",
    label: "礼服look",
    fileUrl: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=400&q=80",
    thumbUrl: null,
  },
];
