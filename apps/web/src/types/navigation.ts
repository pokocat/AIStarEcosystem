// ─────────────────────────────────────────────────────────────────────────────
// navigation.ts — 导航 / 命令面板。
// ─────────────────────────────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";
import type { ID } from "./_shared";
import type { Artist } from "./artist";

export type CommandItemType = "page" | "artist" | "action";

export interface CommandItem {
  id: ID;
  type: CommandItemType;
  icon: LucideIcon;
  label: string;
  desc?: string;
  keywords: string[];
  /** 目标页面 ID（非 artist 类型通常都有）。 */
  pageId?: string;
  /** 仅 artist 类型携带。 */
  artist?: Artist;
}
