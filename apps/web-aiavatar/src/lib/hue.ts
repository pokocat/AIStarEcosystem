// ============================================================
// hue.ts — 由字符串稳定派生色相（0–360），用于占位图 hue 着色。
// 原型里每个资产带 `hue` 字段；真实模型无此字段，改为按 id/name 稳定哈希。
// ============================================================

const PALETTE = [28, 12, 200, 340, 268, 174, 48, 220, 88, 308];

export function hueFor(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
