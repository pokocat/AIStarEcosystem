import type { AvatarConfig } from "@/vendor/react-notion-avatar";

const BACKGROUNDS = ["#e7e0d6", "#e0e7e3", "#dfe5ec", "#ece1de", "#e5e0ec", "#ece8d9"];

/** The random account UID is the seed. Keep v1 stable: refreshes, devices and name changes must not reroll it. */
export function defaultAccountAvatar(accountId: string): { config: AvatarConfig; bgColor: string } {
  let state = 2166136261;
  for (const char of `studio-avatar-v1:${accountId}`) {
    state = Math.imul(state ^ char.codePointAt(0)!, 16777619);
  }
  const pick = (count: number) => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return Math.floor(((value ^ (value >>> 14)) >>> 0) / 4294967296 * count);
  };
  // Counts match upstream 1.1.12; optional decoration defaults follow getRandomConfig().
  return {
    config: { face: pick(12), eye: pick(15), eyebrow: pick(17), glass: pick(14), hair: pick(59), mouth: pick(21), nose: pick(15), accessory: 0, beard: 0, detail: 0 },
    bgColor: BACKGROUNDS[pick(BACKGROUNDS.length)],
  };
}

export function accountAvatarUrl(value?: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
