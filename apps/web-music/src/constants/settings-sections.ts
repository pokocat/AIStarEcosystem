// ─────────────────────────────────────────────────────────────────────────────
// settings-sections.ts — 设置页侧边栏 Tab 配置。
// ─────────────────────────────────────────────────────────────────────────────

import { User, Key, Bell, Palette, CreditCard, Download } from "lucide-react";
import type { SettingsSection } from "@ai-star-eco/types/settings";

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: "profile",      icon: User,       label: "个人资料" },
  { id: "account",      icon: Key,        label: "账号安全" },
  { id: "notification", icon: Bell,       label: "通知设置" },
  { id: "appearance",   icon: Palette,    label: "外观" },
  { id: "billing",      icon: CreditCard, label: "消费流水" },
  { id: "data",         icon: Download,   label: "数据管理" },
];
