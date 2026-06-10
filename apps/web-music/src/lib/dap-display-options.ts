// ─────────────────────────────────────────────────────────────────────────────
// dap-display-options.ts — 数字人形象资产的统一选项构建。
// 把 DapAvatar 的定妆照 / 三机位 / 形象变体 / 造型 / 场景图拍平成可选展示图列表，
// 供「引入数字人」弹窗与艺人视图的 AI 形象画廊共用（URL 去重）。
// ─────────────────────────────────────────────────────────────────────────────

import {
  IMAGE_DERIV_KINDS,
  listDapDerivatives,
  listDapLooks,
  type DapAvatarLite,
  type DapDerivativeLite,
  type DapLookLite,
} from "@/api/dap-avatars";

export interface DisplayOption {
  /** null = 跟随定妆照；"look:<id>" / "deriv:<id>" / "variant:<idx>" / "shot:<name>" */
  ref: string | null;
  url: string;
  label: string;
  group: DisplayGroup;
}

export type DisplayGroup = "定妆照与机位" | "形象变体" | "造型" | "场景图";
export const DISPLAY_GROUPS: DisplayGroup[] = ["定妆照与机位", "形象变体", "造型", "场景图"];
export const SHOT_LABELS: Record<string, string> = { "front-half": "正面半身", right: "右侧脸", left: "左侧脸" };

export function buildDisplayOptions(
  avatar: DapAvatarLite,
  looks: DapLookLite[],
  derivs: DapDerivativeLite[],
): DisplayOption[] {
  const opts: DisplayOption[] = [];
  const seen = new Set<string>();
  const push = (o: DisplayOption) => {
    if (o.url && !seen.has(o.url)) { seen.add(o.url); opts.push(o); }
  };
  if (avatar.imageUrl) {
    push({ ref: null, url: avatar.imageUrl, label: "定妆照（默认）", group: "定妆照与机位" });
  }
  for (const [k, url] of Object.entries(avatar.shotImages ?? {})) {
    push({ ref: `shot:${k}`, url, label: SHOT_LABELS[k] ?? k, group: "定妆照与机位" });
  }
  (avatar.variantImages ?? []).forEach((url, i) => {
    push({ ref: `variant:${i}`, url, label: `形象变体 ${i + 1}`, group: "形象变体" });
  });
  for (const l of looks) {
    if (l.imageUrl) push({ ref: `look:${l.id}`, url: l.imageUrl, label: l.label || "造型", group: "造型" });
  }
  for (const d of derivs) {
    if (!IMAGE_DERIV_KINDS.includes(d.kind)) continue;
    const url = d.fileUrl || d.thumbUrl;
    if (url) push({ ref: `deriv:${d.id}`, url, label: d.label || d.kind, group: "场景图" });
  }
  return opts;
}

/** 拉取造型 + 场景图后构建完整选项列表（look / deriv 拉取失败时静默忽略该组）。 */
export async function loadDisplayOptions(avatar: DapAvatarLite): Promise<DisplayOption[]> {
  const [looks, derivs] = await Promise.all([
    listDapLooks(avatar.id).catch(() => []),
    listDapDerivatives(avatar.id).catch(() => []),
  ]);
  return buildDisplayOptions(avatar, looks, derivs);
}
