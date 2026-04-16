import type { LucideIcon } from "lucide-react";

export type AdminRole = "SUPER_ADMIN" | "OPERATOR";
export type UserStatus = "active" | "suspended" | "deleted";
export type RiskLevel = "high" | "medium" | "low";
export type RiskStatus = "pending" | "resolved" | "false_positive";
export type LicenseStatus = "active" | "expiring" | "revoked";
export type LedgerDirection = "grant" | "consume" | "refund" | "manual_expire";

export type TimeRange = "today" | "week" | "month";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export type Metric = {
  title: string;
  value: string;
  delta: string;
  description: string;
};

export type UserRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  signupMethod: string;
  role: "fan" | "producer" | "coach";
  plan: "free" | "pro" | "enterprise";
  credits: number;
  tenant: string;
  status: UserStatus;
  registeredAt: string;
  lastLoginAt: string;
};

export type TenantRecord = {
  id: string;
  name: string;
  type: "个人工作室" | "企业" | "MCN 机构";
  members: number;
  plan: "free" | "pro" | "enterprise";
  credits: number;
  owner: string;
  createdAt: string;
  status: "healthy" | "frozen";
};

export type AdminAccount = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: AdminRole;
  status: "active" | "suspended";
  lastLoginAt: string;
};

export type PlanRecord = {
  id: string;
  name: "free" | "pro" | "enterprise";
  monthlyPrice: string;
  yearlyPrice: string;
  singers: string;
  monthlyCredits: string;
  nftLimit: string;
  channels: string;
  features: string[];
};

export type FeatureRecord = {
  code: string;
  name: string;
  description: string;
  plans: Array<"free" | "pro" | "enterprise">;
  status: "enabled" | "disabled";
};

export type EntitlementRecord = {
  id: string;
  subject: string;
  subjectType: "user" | "tenant";
  plan: "free" | "pro" | "enterprise";
  feature: string;
  quota: string;
  expiresAt: string;
  status: "effective" | "expiring" | "revoked";
};

export type PriceRuleRecord = {
  meter: string;
  plan: "free" | "pro" | "enterprise";
  cost: string;
  period: string;
  status: "enabled" | "disabled";
};

export type WalletSummary = {
  label: string;
  value: string;
  share: string;
};

export type LedgerRecord = {
  id: string;
  subject: string;
  direction: LedgerDirection;
  account: string;
  amount: string;
  operator: string;
  createdAt: string;
};

export type LicenseBatchRecord = {
  id: string;
  product: string;
  plan: "pro" | "enterprise";
  type: "时长兑换" | "积分包" | "席位扩容";
  progress: string;
  remainingRate: number;
  channel: string;
  validRange: string;
  status: LicenseStatus;
};

export type LicenseKeyRecord = {
  key: string;
  status: "created" | "sold" | "activated" | "revoked";
  user: string;
  activatedAt: string;
};

export type AuditRecord = {
  id: string;
  createdAt: string;
  operator: string;
  role: AdminRole;
  action: string;
  target: string;
  ip: string;
  result: "success" | "failed";
  detail: string;
};

export type RiskRecord = {
  id: string;
  level: RiskLevel;
  type: string;
  user: string;
  triggeredAt: string;
  status: RiskStatus;
  suggestion: string;
};
