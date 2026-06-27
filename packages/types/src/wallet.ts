// ─────────────────────────────────────────────────────────────────────────────
// wallet.ts — 个人钱包与点数流水。
// Wallet 1:1 → AepUser；与后端 aep_wallets / aep_ledger_entries 对齐。
// 见 product_spec.md §1.3 / §1.4 / §3.4。
// ─────────────────────────────────────────────────────────────────────────────

import type { ID, ISODateTime } from "./_shared";

// ── 钱包余额（原始整数，单位 credits） ───────────────────────────────────────

export interface Wallet {
  id: ID;
  userId: ID;
  /** v0.58：账号登录名（admin 结算中心视图回填；用户自查接口省略） */
  username?: string;
  /** v0.58：账号昵称（同上） */
  displayName?: string;
  totalBalance: number;        // = licenseBalance + rechargeBalance + giftBalance
  licenseBalance: number;      // License 核销累计入账
  rechargeBalance: number;     // 充值累计入账
  giftBalance: number;         // 平台赠送 / 活动奖励
  pendingBalance: number;      // 结算中（业务收益等待入账）
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

// ── 点数流水 ──────────────────────────────────────────────────────────────────

export type LedgerEntryType =
  | "license_grant"        // License 核销时一次性入账
  | "recharge"             // 充值入账
  | "refund"               // 退款入账
  | "income"               // 业务收益入账（NFT 售卖 / 版税 / 打赏 ...）
  | "gift"                 // 平台赠送 / 活动奖励
  | "spend"                // 消费扣减
  | "withdraw"             // 提现扣减
  | "freeze"               // 冻结
  | "unfreeze"             // 解冻
  | "adjust";              // 管理员手动调账

export interface LedgerEntry {
  id: ID;
  walletId: ID;
  userId: ID;
  /** v0.58：账号登录名（admin 结算中心视图回填；用户自查接口省略） */
  username?: string;
  /** v0.58：账号昵称（同上） */
  displayName?: string;
  type: LedgerEntryType;
  amount: number;            // 原始整数；正数=入账，负数=出账
  balanceAfter: number;      // 入账后总余额
  description: string;       // 中性描述，前端可本地化
  referenceId?: string;      // 关联业务实体 id
  referenceType?: string;    // "song_revenue" / "nft_sale" / "license_key" 等
  createdAt: ISODateTime;
}

// ── v0.4：充值套餐（小程序"我的"页 + 充值页消费） ─────────────────────────────

export interface RechargePackage {
  id: ID;
  /** 套餐总积分（充进 rechargeBalance） */
  credits: number;
  /** 价格（人民币分） */
  priceCents: number;
  /** 套餐标签：体验包 / 标准包 / 热门包 / 企业包 */
  tag: string;
  /** 是否推荐 */
  recommended: boolean;
  /** 赠送积分（充进 giftBalance），可选 */
  bonusCredits?: number;
  /** 排序权重，越小越靠前 */
  sortOrder?: number;
  /** v2 §6 适用子应用：all=通用（所有子应用可见）/ music|drama|celebrity|aiavatar|star */
  appScope?: string;
}

/** 充值下单请求体（前端 → 服务端） */
export interface RechargeRequest {
  packageId: ID;
  /** 用户备注：付款方式 / 转账后四位等（可选） */
  note?: string;
}

/** 充值响应（服务端 → 前端） */
export interface RechargeResponse {
  /** 落账后的最新钱包 */
  wallet: Wallet;
  /** 本次落账记录（recharge 主分录；如有 bonus 仍然只返回主分录） */
  ledgerEntry: LedgerEntry;
}

// ── v0.56：充值订单 / 账单（下单 → 运营核准入账） ───────────────────────────────

/**
 * 充值订单状态机：
 * - pending：已下单待确认（用户已提交，等待平台收款核准）
 * - paid：已核准并到账（积分已入账）
 * - rejected：已驳回（收款不符 / 无效）
 * - cancelled：用户取消
 * - refunded：已退款（v2 §15.5 / D17：现金退款 + 未消费积分回收）
 */
export type RechargeOrderStatus = "pending" | "paid" | "rejected" | "cancelled" | "refunded";

/** 充值订单。下单即生成 PENDING 账单，平台运营线下收款后核准方入账。 */
export interface RechargeOrder {
  id: ID;
  userId: ID;
  /** 下单时快照的账号信息（admin 列表展示用） */
  username?: string;
  displayName?: string;
  studioName?: string;
  packageId: ID;
  packageTag?: string;
  /** 套餐积分（快照） */
  credits: number;
  /** 赠送积分（快照） */
  bonusCredits: number;
  /** 价格（人民币分，快照） */
  priceCents: number;
  status: RechargeOrderStatus;
  /** 用户备注（付款方式 / 转账后四位等） */
  userNote?: string;
  /** 审批人（admin 标识） */
  reviewerId?: string;
  /** 审批备注 / 驳回原因 */
  reviewNote?: string;
  createdAt: ISODateTime;
  updatedAt?: ISODateTime;
  reviewedAt?: ISODateTime;
  /**
   * v2 §6 在线支付（Jeepay / 影子）可见性（线下 / 未支付订单字段省略）：
   * paidVia 入账来源 manual（线下核准）| jeepay（在线真实）| shadow（在线影子）；
   * channelPayNo 渠道流水号（对账追溯）；wayCode 支付方式；payOrderId 网关订单号；
   * paidAt 到账时间；sourceApp 来源子应用。
   */
  paidVia?: "manual" | "jeepay" | "shadow" | string;
  channelPayNo?: string;
  wayCode?: string;
  payOrderId?: string;
  paidAt?: ISODateTime;
  sourceApp?: string;
  /** v2 §15.5 / D17 退款回收（仅 refunded 订单有值）：退款时间 / 实退积分 / 回收账本分录 id */
  refundedAt?: ISODateTime;
  refundedCredits?: number;
  refundLedgerEntryId?: string;
}
