// ─────────────────────────────────────────────────────────────────────────────
// fab-actions.ts — 悬浮按钮（FAB）快捷入口配置。
// ─────────────────────────────────────────────────────────────────────────────

import { Music, Users, Wand2, Upload, type LucideIcon } from "lucide-react";

export interface FABAction {
  id: string;
  icon: LucideIcon;
  label: string;
  color: string;
  bg: string;
}

export const FAB_ACTIONS: FABAction[] = [
  { id: "studio",       icon: Music,  label: "创作内容", color: "text-cyan-400",   bg: "bg-cyan-500/20 hover:bg-cyan-500/30" },
  { id: "incubator",    icon: Wand2,  label: "孵化艺人", color: "text-purple-400", bg: "bg-purple-500/20 hover:bg-purple-500/30" },
  { id: "distribution", icon: Upload, label: "发布分发", color: "text-green-400",  bg: "bg-green-500/20 hover:bg-green-500/30" },
  { id: "community",    icon: Users,  label: "粉丝运营", color: "text-pink-400",   bg: "bg-pink-500/20 hover:bg-pink-500/30" },
];
