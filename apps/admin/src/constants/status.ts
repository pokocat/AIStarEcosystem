// Light-mode badge styles for all workflow statuses surfaced in the admin.
// Keys map directly to the union types declared in src/types/*.ts.

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "primary";

export const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  primary: "bg-indigo-50 text-indigo-700 ring-indigo-200",
};

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** Whether the status is a human-intervention point (i.e. surfaced as queue). */
  actionable?: boolean;
}

// Artist lifecycle
export const ARTIST_STATUS: Record<string, StatusMeta> = {
  trainee: { label: "练习生", tone: "neutral", actionable: true },
  debut: { label: "新人出道", tone: "info", actionable: true },
  active: { label: "活跃艺人", tone: "success" },
  rest: { label: "休整中", tone: "warning" },
  retired: { label: "已退役", tone: "danger" },
};

export const ARTIST_QUALITY: Record<string, StatusMeta> = {
  common: { label: "普通", tone: "neutral" },
  rare: { label: "稀有", tone: "info" },
  epic: { label: "史诗", tone: "primary" },
  legendary: { label: "传说", tone: "warning" },
};

// Coach / MCN contracts
export const SIGNED_ARTIST_STATUS: Record<string, StatusMeta> = {
  active: { label: "履约中", tone: "success" },
  negotiating: { label: "谈判中", tone: "warning", actionable: true },
  expiring: { label: "临期", tone: "danger", actionable: true },
};

// Distribution queue
export const DISTRIBUTION_QUEUE_STATUS: Record<string, StatusMeta> = {
  reviewing: { label: "待审核", tone: "warning", actionable: true },
  approved: { label: "已通过", tone: "success" },
  distributing: { label: "分发中", tone: "info" },
};

// Copyright
export const COPYRIGHT_STATUS: Record<string, StatusMeta> = {
  pending: { label: "待核验", tone: "warning", actionable: true },
  verified: { label: "已核验", tone: "success" },
};

// Platform
export const PLATFORM_STATUS: Record<string, StatusMeta> = {
  connected: { label: "已接入", tone: "success" },
  pending: { label: "接入审核", tone: "warning", actionable: true },
  disconnected: { label: "已断开", tone: "danger" },
};

// Content distribution
export const CONTENT_DISTRIBUTION_STATUS: Record<string, StatusMeta> = {
  published: { label: "已发布", tone: "success" },
  distributing: { label: "分发中", tone: "info" },
  scheduled: { label: "定时发布", tone: "primary", actionable: true },
  draft: { label: "草稿", tone: "neutral", actionable: true },
};

// Music
export const SONG_STATUS: Record<string, StatusMeta> = {
  recording: { label: "录制中", tone: "info" },
  mixing: { label: "混音中", tone: "primary", actionable: true },
  released: { label: "已发行", tone: "success" },
};
export const ALBUM_STATUS: Record<string, StatusMeta> = {
  planning: { label: "筹备中", tone: "neutral" },
  recording: { label: "制作中", tone: "info" },
  released: { label: "已发行", tone: "success" },
};
export const CONCERT_STATUS: Record<string, StatusMeta> = {
  planning: { label: "筹备中", tone: "neutral" },
  selling: { label: "售票中", tone: "warning", actionable: true },
  completed: { label: "已完成", tone: "success" },
};

// Film
export const DRAMA_STATUS: Record<string, StatusMeta> = {
  casting: { label: "选角中", tone: "neutral" },
  filming: { label: "拍摄中", tone: "info" },
  "post-production": { label: "后期制作", tone: "primary", actionable: true },
  released: { label: "已上线", tone: "success" },
};
export const MOVIE_STATUS: Record<string, StatusMeta> = {
  "pre-production": { label: "前期筹备", tone: "neutral" },
  filming: { label: "拍摄中", tone: "info" },
  "post-production": { label: "后期制作", tone: "primary", actionable: true },
  released: { label: "已上映", tone: "success" },
};
export const AD_STATUS: Record<string, StatusMeta> = {
  negotiating: { label: "洽谈中", tone: "warning", actionable: true },
  shooting: { label: "拍摄中", tone: "info" },
  completed: { label: "已交付", tone: "success" },
};
export const VOICE_WORK_STATUS: Record<string, StatusMeta> = {
  recording: { label: "录音中", tone: "info" },
  editing: { label: "剪辑中", tone: "primary" },
  delivered: { label: "已交付", tone: "success" },
};

// Finance
export const TRANSACTION_STATUS: Record<string, StatusMeta> = {
  completed: { label: "已到账", tone: "success" },
  processing: { label: "处理中", tone: "warning", actionable: true },
  pending: { label: "待复核", tone: "danger", actionable: true },
};

// Community events
export const COMMUNITY_EVENT_STATUS: Record<string, StatusMeta> = {
  live: { label: "进行中", tone: "success" },
  upcoming: { label: "即将开始", tone: "warning", actionable: true },
  ended: { label: "已结束", tone: "neutral" },
};

export const COMMUNITY_EVENT_TYPE: Record<string, string> = {
  meetup: "粉丝见面",
  vote: "粉丝投票",
  challenge: "挑战赛",
  anniversary: "纪念活动",
};

// Notification
export const NOTIFICATION_TYPE: Record<string, { label: string; tone: StatusTone }> = {
  revenue: { label: "收益", tone: "success" },
  fan: { label: "粉丝", tone: "primary" },
  content: { label: "内容", tone: "info" },
  system: { label: "系统", tone: "warning" },
  achievement: { label: "成就", tone: "primary" },
};

// Pose
export const POSE_DIFFICULTY: Record<string, StatusMeta> = {
  easy: { label: "入门", tone: "success" },
  medium: { label: "进阶", tone: "warning" },
  hard: { label: "困难", tone: "danger" },
};

// Wardrobe rarity uses ARTIST_QUALITY visually

// ── 平台账户域 ────────────────────────────────────────────────────────────────
export const ACCOUNT_STATUS: Record<string, StatusMeta> = {
  active: { label: "启用", tone: "success" },
  suspended: { label: "停用", tone: "warning", actionable: true },
  deleted: { label: "已注销", tone: "danger" },
};

export const ACCOUNT_KIND: Record<string, StatusMeta> = {
  personal: { label: "个人", tone: "neutral" },
  studio: { label: "工作室", tone: "primary" },
};

export const TENANT_KIND: Record<string, StatusMeta> = {
  platform: { label: "平台", tone: "primary" },
  personal: { label: "个人池", tone: "neutral" },
  organization: { label: "机构", tone: "info" },
};

export const STUDIO_KIND: Record<string, StatusMeta> = {
  personal_creator: { label: "个人创作者", tone: "neutral" },
  music_studio:     { label: "音乐工作室", tone: "info" },
  drama_studio:     { label: "短剧工作室", tone: "primary" },
  variety_studio:   { label: "综艺工作室", tone: "warning" },
  agency:           { label: "经纪公司",   tone: "primary" },
  mcn:              { label: "MCN 机构",   tone: "success" },
};

export const STUDIO_STATUS: Record<string, StatusMeta> = {
  active: { label: "正常", tone: "success" },
  suspended: { label: "暂停", tone: "warning", actionable: true },
  deleted: { label: "已注销", tone: "danger" },
};

// ── License ──────────────────────────────────────────────────────────────────
export const LICENSE_BATCH_STATUS: Record<string, StatusMeta> = {
  active:    { label: "发放中", tone: "success" },
  exhausted: { label: "已售罄", tone: "neutral" },
  revoked:   { label: "已撤回", tone: "danger" },
  expired:   { label: "已过期", tone: "warning" },
};

export const LICENSE_KEY_STATUS: Record<string, StatusMeta> = {
  created:   { label: "未兑换", tone: "neutral" },
  activated: { label: "已兑换", tone: "success" },
  expired:   { label: "已过期", tone: "warning" },
  revoked:   { label: "已撤回", tone: "danger" },
};

// ── Ledger / Wallet ──────────────────────────────────────────────────────────
export const LEDGER_ENTRY_TYPE: Record<string, StatusMeta> = {
  license_grant: { label: "License 入账", tone: "primary" },
  recharge:      { label: "充值",         tone: "success" },
  refund:        { label: "退款",         tone: "info" },
  income:        { label: "业务收益",     tone: "success" },
  gift:          { label: "赠送",         tone: "info" },
  spend:         { label: "消费",         tone: "neutral" },
  withdraw:      { label: "提现",         tone: "warning" },
  freeze:        { label: "冻结",         tone: "danger", actionable: true },
  unfreeze:      { label: "解冻",         tone: "info" },
  adjust:        { label: "人工调账",     tone: "warning", actionable: true },
};

// ── 积分包 ───────────────────────────────────────────────────────────────────
export const CREDIT_PACK_STATUS: Record<string, StatusMeta> = {
  active:   { label: "上架", tone: "success" },
  archived: { label: "下架", tone: "neutral" },
};
