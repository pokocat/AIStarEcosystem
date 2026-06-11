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
    variantImages: [
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80",
      "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&q=80",
    ],
    shotImages: {
      "front-half": "https://images.unsplash.com/photo-1618641986557-1ecd230959aa?w=400&q=80",
      right: "https://images.unsplash.com/photo-1463453091185-61582044d556?w=400&q=80",
      left: "https://images.unsplash.com/photo-1492447166138-50c3889fccb1?w=400&q=80",
    },
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

/** mock 版展示图解析：ref → 资产 URL，未命中回退定妆照（镜像 server DapAvatarRefResolver）。 */
export function resolveMockDisplayImage(avatar: DapAvatarLite, ref: string | null): string | null {
  if (ref) {
    if (ref.startsWith("look:")) {
      const l = MOCK_DAP_LOOKS.find((x) => x.id === ref.slice(5));
      if (l?.imageUrl) return l.imageUrl;
    } else if (ref.startsWith("deriv:")) {
      const d = MOCK_DAP_DERIVS.find((x) => x.id === ref.slice(6));
      const url = d?.fileUrl || d?.thumbUrl;
      if (url) return url;
    } else if (ref.startsWith("variant:")) {
      const url = (avatar.variantImages ?? [])[Number(ref.slice(8))];
      if (url) return url;
    } else if (ref.startsWith("shot:")) {
      const url = avatar.shotImages?.[ref.slice(5)];
      if (url) return url;
    }
  }
  return avatar.imageUrl ?? null;
}
