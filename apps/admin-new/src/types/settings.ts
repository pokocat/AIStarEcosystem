// ─────────────────────────────────────────────────────────────────────────────
// settings.ts — 用户设置 / 订阅 / 账单。
// ─────────────────────────────────────────────────────────────────────────────

import type { LucideIcon } from "lucide-react";
import type { ID, ISODate } from "./_shared";

export type SettingsSectionId =
  | "profile" | "account" | "notification" | "appearance" | "billing" | "data";

export interface SettingsSection {
  id: SettingsSectionId;
  icon: LucideIcon;
  label: string;
}

export interface SubscriptionPlan {
  id: ID;
  name: string;          // 展示名，如 "专业版"
  code: "free" | "pro" | "enterprise";
  price: string;         // 展示价格，如 "¥299/月"
  features: string[];
  current: boolean;
}

export interface BillingRecord {
  id: ID;
  date: ISODate;
  desc: string;
  amount: string;
}
