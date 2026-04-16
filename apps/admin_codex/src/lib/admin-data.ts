import {
  Activity,
  BadgeCheck,
  BookKey,
  BriefcaseBusiness,
  Building2,
  CreditCard,
  LayoutDashboard,
  LockKeyhole,
  ScanSearch,
  Settings2,
  ShieldCheck,
  ShieldEllipsis,
  Sparkles,
  Users,
} from "lucide-react";

import type {
  AdminAccount,
  AuditRecord,
  EntitlementRecord,
  FeatureRecord,
  LedgerRecord,
  LicenseBatchRecord,
  LicenseKeyRecord,
  Metric,
  NavGroup,
  PlanRecord,
  PriceRuleRecord,
  RiskRecord,
  TenantRecord,
  TimeRange,
  UserRecord,
  WalletSummary,
} from "@/types/admin";

export const navGroups: NavGroup[] = [
  {
    title: "总览",
    items: [{ title: "概览看板", href: "/admin", icon: LayoutDashboard, exact: true }],
  },
  {
    title: "运营对象",
    items: [
      { title: "平台用户", href: "/admin/users", icon: Users },
      { title: "租户管理", href: "/admin/tenants", icon: Building2 },
      { title: "管理员账号", href: "/admin/admins", icon: ShieldCheck },
    ],
  },
  {
    title: "策略与权益",
    items: [
      { title: "角色列表", href: "/admin/roles", icon: BriefcaseBusiness },
      { title: "权限点管理", href: "/admin/permissions", icon: LockKeyhole },
      { title: "套餐配置", href: "/admin/plans", icon: Sparkles },
      { title: "功能点管理", href: "/admin/features", icon: BadgeCheck },
      { title: "权益详情", href: "/admin/entitlements", icon: ShieldEllipsis },
    ],
  },
  {
    title: "账务与资产",
    items: [
      { title: "积分概览", href: "/admin/credits", icon: CreditCard },
      { title: "人工调账", href: "/admin/credits/adjust", icon: Activity },
      { title: "价格规则", href: "/admin/price-rules", icon: ScanSearch },
      { title: "卡密批次", href: "/admin/licenses", icon: BookKey },
    ],
  },
  {
    title: "治理",
    items: [
      { title: "审计日志", href: "/admin/audit", icon: Activity },
      { title: "风控事件", href: "/admin/risk", icon: ShieldCheck },
      { title: "系统设置", href: "/admin/settings", icon: Settings2 },
    ],
  },
];

export const users: UserRecord[] = [
  {
    id: "usr_1001",
    name: "Luna Echo",
    email: "luna.echo@star.fm",
    phone: "138****0921",
    signupMethod: "wechat",
    role: "producer",
    plan: "enterprise",
    credits: 5800,
    tenant: "Nebula Studio",
    status: "active",
    registeredAt: "2026-04-01 09:42",
    lastLoginAt: "2026-04-16 18:20",
  },
  {
    id: "usr_1002",
    name: "Kai Polaris",
    email: "kai.p@creator.io",
    phone: "186****6611",
    signupMethod: "google",
    role: "coach",
    plan: "pro",
    credits: 2120,
    tenant: "Aurora MCN",
    status: "active",
    registeredAt: "2026-04-03 12:18",
    lastLoginAt: "2026-04-16 16:44",
  },
  {
    id: "usr_1003",
    name: "Mika Nova",
    email: "mika.nova@mail.com",
    phone: "139****5529",
    signupMethod: "email",
    role: "fan",
    plan: "free",
    credits: 92,
    tenant: "个人账户",
    status: "suspended",
    registeredAt: "2026-04-05 21:03",
    lastLoginAt: "2026-04-12 14:11",
  },
  {
    id: "usr_1004",
    name: "Zero Tangent",
    email: "zero@lab.ai",
    phone: "137****4480",
    signupMethod: "wallet",
    role: "producer",
    plan: "pro",
    credits: 760,
    tenant: "Quantum Forge",
    status: "active",
    registeredAt: "2026-04-07 08:55",
    lastLoginAt: "2026-04-16 19:01",
  },
  {
    id: "usr_1005",
    name: "Rin Azure",
    email: "rin.azure@aep.co",
    phone: "159****0188",
    signupMethod: "google",
    role: "producer",
    plan: "enterprise",
    credits: 9980,
    tenant: "Aisinger Growth",
    status: "deleted",
    registeredAt: "2026-03-28 10:35",
    lastLoginAt: "2026-04-10 10:42",
  },
];

export const tenants: TenantRecord[] = [
  {
    id: "tenant_01",
    name: "Nebula Studio",
    type: "企业",
    members: 26,
    plan: "enterprise",
    credits: 28600,
    owner: "Luna Echo",
    createdAt: "2026-03-18 09:30",
    status: "healthy",
  },
  {
    id: "tenant_02",
    name: "Aurora MCN",
    type: "MCN 机构",
    members: 14,
    plan: "pro",
    credits: 12050,
    owner: "Kai Polaris",
    createdAt: "2026-03-29 17:12",
    status: "healthy",
  },
  {
    id: "tenant_03",
    name: "Quantum Forge",
    type: "个人工作室",
    members: 3,
    plan: "pro",
    credits: 860,
    owner: "Zero Tangent",
    createdAt: "2026-04-02 13:20",
    status: "frozen",
  },
];

export const adminAccounts: AdminAccount[] = [
  {
    id: "adm_01",
    username: "admin",
    displayName: "Zoe Han",
    email: "admin@aistareco.com",
    role: "SUPER_ADMIN",
    status: "active",
    lastLoginAt: "2026-04-16 20:04",
  },
  {
    id: "adm_02",
    username: "operator",
    displayName: "Lin Yao",
    email: "operator@aistareco.com",
    role: "OPERATOR",
    status: "active",
    lastLoginAt: "2026-04-16 18:55",
  },
  {
    id: "adm_03",
    username: "nightwatch",
    displayName: "Qin Mo",
    email: "watch@aistareco.com",
    role: "OPERATOR",
    status: "suspended",
    lastLoginAt: "2026-04-14 23:41",
  },
];

export const plans: PlanRecord[] = [
  {
    id: "plan_free",
    name: "free",
    monthlyPrice: "¥0",
    yearlyPrice: "¥0",
    singers: "≤ 3",
    monthlyCredits: "5 / day",
    nftLimit: "—",
    channels: "国内分发",
    features: ["基础音乐生成", "平台内分发", "基础榜单曝光"],
  },
  {
    id: "plan_pro",
    name: "pro",
    monthlyPrice: "¥299",
    yearlyPrice: "¥2,990",
    singers: "≤ 20",
    monthlyCredits: "50 / day",
    nftLimit: "≤ 10 / month",
    channels: "全渠道",
    features: ["高质量音乐生成", "NFT 铸造", "渠道分发"],
  },
  {
    id: "plan_enterprise",
    name: "enterprise",
    monthlyPrice: "定制报价",
    yearlyPrice: "定制报价",
    singers: "unlimited",
    monthlyCredits: "unlimited",
    nftLimit: "unlimited",
    channels: "全渠道 + priority",
    features: ["市场签约", "优先任务队列", "企业级配额覆盖"],
  },
];

export const features: FeatureRecord[] = [
  {
    code: "ai_singer.create",
    name: "AI 歌手创建",
    description: "支持创建、绑定与管理 AI 艺人角色。",
    plans: ["free", "pro", "enterprise"],
    status: "enabled",
  },
  {
    code: "music.generate",
    name: "音乐生成",
    description: "调用 AI 音乐生成能力并按次扣点。",
    plans: ["free", "pro", "enterprise"],
    status: "enabled",
  },
  {
    code: "distribution.global",
    name: "全球分发",
    description: "支持更广泛的发行渠道与优先队列。",
    plans: ["pro", "enterprise"],
    status: "enabled",
  },
  {
    code: "ai_singer.nft.mint",
    name: "NFT 铸造",
    description: "开放 NFT 收藏品铸造与发行。",
    plans: ["pro", "enterprise"],
    status: "enabled",
  },
  {
    code: "market.signing",
    name: "市场签约",
    description: "企业客户可进行签约与权益协商。",
    plans: ["enterprise"],
    status: "disabled",
  },
];

export const entitlements: EntitlementRecord[] = [
  {
    id: "ent_01",
    subject: "Nebula Studio",
    subjectType: "tenant",
    plan: "enterprise",
    feature: "市场签约优先权",
    quota: "无限",
    expiresAt: "2027-03-18",
    status: "effective",
  },
  {
    id: "ent_02",
    subject: "Kai Polaris",
    subjectType: "user",
    plan: "pro",
    feature: "AI 音乐点数",
    quota: "1,500 / month",
    expiresAt: "2026-05-03",
    status: "expiring",
  },
  {
    id: "ent_03",
    subject: "Quantum Forge",
    subjectType: "tenant",
    plan: "pro",
    feature: "席位扩容",
    quota: "+5 成员",
    expiresAt: "2026-04-30",
    status: "revoked",
  },
];

export const priceRules: PriceRuleRecord[] = [
  {
    meter: "music.generate",
    plan: "free",
    cost: "5 credits / task",
    period: "长期生效",
    status: "enabled",
  },
  {
    meter: "music.generate",
    plan: "pro",
    cost: "3 credits / task",
    period: "长期生效",
    status: "enabled",
  },
  {
    meter: "video.render.minute",
    plan: "enterprise",
    cost: "8 credits / minute",
    period: "2026-04-01 ~ 2026-05-01 活动价",
    status: "enabled",
  },
];

export const walletSummaries: WalletSummary[] = [
  { label: "通用点数", value: "182,440", share: "51%" },
  { label: "AI 音乐点数", value: "96,120", share: "27%" },
  { label: "赠送点数", value: "54,300", share: "15%" },
  { label: "待清退点数", value: "23,120", share: "7%" },
];

export const ledgerRecords: LedgerRecord[] = [
  {
    id: "led_01",
    subject: "Nebula Studio",
    direction: "grant",
    account: "通用点数",
    amount: "+12,000",
    operator: "Zoe Han",
    createdAt: "2026-04-16 14:05",
  },
  {
    id: "led_02",
    subject: "Luna Echo",
    direction: "consume",
    account: "AI 音乐点数",
    amount: "-45",
    operator: "系统自动结算",
    createdAt: "2026-04-16 14:22",
  },
  {
    id: "led_03",
    subject: "Aurora MCN",
    direction: "refund",
    account: "通用点数",
    amount: "+15",
    operator: "任务失败补回",
    createdAt: "2026-04-16 15:17",
  },
  {
    id: "led_04",
    subject: "Mika Nova",
    direction: "manual_expire",
    account: "赠送点数",
    amount: "-30",
    operator: "Lin Yao",
    createdAt: "2026-04-16 16:41",
  },
];

export const licenseBatches: LicenseBatchRecord[] = [
  {
    id: "batch_PRO_20260416_A",
    product: "AI 歌手",
    plan: "pro",
    type: "积分包",
    progress: "1,200 / 860 / 340",
    remainingRate: 28,
    channel: "华东直营",
    validRange: "2026-04-16 ~ 2026-06-30",
    status: "active",
  },
  {
    id: "batch_ENT_20260412_B",
    product: "AI 艺人",
    plan: "enterprise",
    type: "席位扩容",
    progress: "280 / 224 / 56",
    remainingRate: 20,
    channel: "海外合作渠道",
    validRange: "2026-04-12 ~ 2026-09-30",
    status: "expiring",
  },
  {
    id: "batch_PRO_20260320_C",
    product: "AI 歌手",
    plan: "pro",
    type: "时长兑换",
    progress: "600 / 600 / 0",
    remainingRate: 0,
    channel: "华南代理",
    validRange: "2026-03-20 ~ 2026-04-15",
    status: "revoked",
  },
];

export const licenseKeys: LicenseKeyRecord[] = [
  { key: "PROA-****-7G9L", status: "activated", user: "Luna Echo", activatedAt: "2026-04-16 10:20" },
  { key: "PROA-****-2K8J", status: "sold", user: "待激活", activatedAt: "—" },
  { key: "PROA-****-9Q4M", status: "created", user: "库存中", activatedAt: "—" },
  { key: "PROA-****-5R1P", status: "revoked", user: "Aurora MCN", activatedAt: "2026-04-15 18:33" },
];

export const auditLogs: AuditRecord[] = [
  {
    id: "audit_01",
    createdAt: "2026-04-16 18:01:22.114",
    operator: "Lin Yao",
    role: "OPERATOR",
    action: "credit.grant",
    target: "tenant_01 / wallet",
    ip: "10.4.12.18",
    result: "success",
    detail: "为 Nebula Studio 补赠 12,000 通用点数，备注：季度渠道补贴。",
  },
  {
    id: "audit_02",
    createdAt: "2026-04-16 18:12:08.098",
    operator: "Zoe Han",
    role: "SUPER_ADMIN",
    action: "staff.update",
    target: "adm_03",
    ip: "10.4.12.6",
    result: "success",
    detail: "将管理员 nightwatch 状态改为 suspended。",
  },
  {
    id: "audit_03",
    createdAt: "2026-04-16 19:07:51.436",
    operator: "Lin Yao",
    role: "OPERATOR",
    action: "license.revoke",
    target: "batch_PRO_20260320_C",
    ip: "10.4.12.18",
    result: "failed",
    detail: "吊销整批失败，原因：批次已被财务冻结，需 SUPER_ADMIN 处理。",
  },
];

export const riskRecords: RiskRecord[] = [
  {
    id: "risk_01",
    level: "high",
    type: "异地登录",
    user: "Mika Nova",
    triggeredAt: "2026-04-16 13:09",
    status: "pending",
    suggestion: "建议核验设备指纹并强制下线。",
  },
  {
    id: "risk_02",
    level: "medium",
    type: "频繁兑换",
    user: "Aurora MCN",
    triggeredAt: "2026-04-16 15:12",
    status: "resolved",
    suggestion: "已确认渠道投放活动造成峰值。",
  },
  {
    id: "risk_03",
    level: "low",
    type: "批量生成",
    user: "Zero Tangent",
    triggeredAt: "2026-04-16 17:44",
    status: "false_positive",
    suggestion: "已标记为误报，属于灰度压测。",
  },
];

export const moderationRecords = [
  {
    user: "Mika Nova",
    action: "suspend",
    reason: "异常激活码兑换行为",
    operator: "Lin Yao",
    createdAt: "2026-04-12 14:20",
  },
  {
    user: "Rin Azure",
    action: "soft_delete",
    reason: "租户合并后清理重复账号",
    operator: "Zoe Han",
    createdAt: "2026-04-10 11:02",
  },
];

export const dashboardMetrics: Record<TimeRange, Metric[]> = {
  today: [
    { title: "新注册用户", value: "164", delta: "+18.2%", description: "较昨日新增 25 位" },
    { title: "活跃用户 DAU", value: "3,842", delta: "+9.4%", description: "制作人占比 44%" },
    { title: "积分消耗", value: "28,440", delta: "+12.1%", description: "AI 音乐任务为主要消耗源" },
    { title: "生成任务", value: "1,206", delta: "98.1% 成功", description: "失败任务 23 条" },
  ],
  week: [
    { title: "新注册用户", value: "1,082", delta: "+11.8%", description: "微信登录贡献 53%" },
    { title: "活跃用户 DAU", value: "19,406", delta: "+6.2%", description: "企业租户持续增长" },
    { title: "积分消耗", value: "192,340", delta: "+14.4%", description: "结算退款率 1.7%" },
    { title: "生成任务", value: "8,932", delta: "97.6% 成功", description: "夜间峰值负载稳定" },
  ],
  month: [
    { title: "新注册用户", value: "4,982", delta: "+22.5%", description: "激活码渠道拉新显著" },
    { title: "活跃用户 DAU", value: "71,208", delta: "+10.8%", description: "MCN 机构贡献高活跃" },
    { title: "积分消耗", value: "742,180", delta: "+17.1%", description: "企业套餐占消耗 61%" },
    { title: "生成任务", value: "35,266", delta: "98.4% 成功", description: "待结算积压 12 单" },
  ],
};

export const creditTrend = [
  { day: "04-10", consume: 24000, recharge: 18000, refund: 680 },
  { day: "04-11", consume: 26800, recharge: 22100, refund: 540 },
  { day: "04-12", consume: 25100, recharge: 19600, refund: 920 },
  { day: "04-13", consume: 28600, recharge: 24300, refund: 760 },
  { day: "04-14", consume: 27320, recharge: 25900, refund: 510 },
  { day: "04-15", consume: 30180, recharge: 26600, refund: 840 },
  { day: "04-16", consume: 28440, recharge: 23120, refund: 620 },
];

export const conversionFunnel = [
  { stage: "注册", value: 4982 },
  { stage: "激活", value: 2840 },
  { stage: "升级 Pro", value: 1160 },
  { stage: "升级 Enterprise", value: 268 },
];

export function getUserById(id: string) {
  return users.find((user) => user.id === id) ?? users[0];
}

export function getTenantById(id: string) {
  return tenants.find((tenant) => tenant.id === id) ?? tenants[0];
}

export function getBatchById(id: string) {
  return licenseBatches.find((batch) => batch.id === id) ?? licenseBatches[0];
}
