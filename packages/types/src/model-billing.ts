/** Model pricing and restricted allowances. Supplier resources are never wallet money. */
export type ModelBillingUnit = 'image' | 'second' | 'call' | 'ktoken' | 'credit';
export interface ModelBillingTarget {
  appCode: string;
  action: string;
  endpointId: string;
  providerModel: string;
  /** Usage/route metadata for audit; grant and discount eligibility only compare endpointId. */
  specKey: string;
  unit: ModelBillingUnit;
}
export interface ModelBillingTargetOption {
  id: string;
  label: string;
  channelName: string;
  target: ModelBillingTarget;
}
export interface ModelBillingWalletOption {
  id: string;
  userId: string;
  displayName: string;
  phone?: string | null;
  accountType: 'personal' | 'enterprise_member';
  enterpriseId?: string | null;
  enterpriseName?: string | null;
}
export interface ModelBillingUserOption { id: string; displayName: string; phone?: string | null }
export interface ModelBillingEnterpriseOption { id: string; name: string; status: string }
export interface ModelUsage { quantity: number; outputQuantity: number }
export interface ModelPriceInput {
  name: string;
  target: ModelBillingTarget;
  unitPrice: number;
  outputUnitPrice?: number | null;
  active: boolean;
  expectedVersion?: number | null;
}
export interface ModelPrice extends ModelPriceInput { id: string; version: number; updatedAt: string }
export interface ModelDiscountInput {
  name: string;
  target: ModelBillingTarget;
  audience: 'all' | 'user' | 'enterprise';
  audienceId?: string | null;
  factor: number;
  /** Eligible endpoint grants are always applied after discounts. */
  allowGrants?: boolean;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  expectedVersion?: number | null;
}
export interface ModelDiscount extends ModelDiscountInput { id: string; version: number; updatedAt: string; audienceLabel?: string | null }
export interface CreditCampaignInput {
  name: string;
  targets: ModelBillingTarget[];
  totalIssueLimit: number;
  perWalletIssueLimit: number;
  /** Deprecated input metadata; grants are limited by credits and expiry. */
  resourceLimit?: number;
  perWalletDailyResourceLimit?: number;
  maxConcurrentPerWallet?: number;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  expectedVersion?: number | null;
}
export interface CreditCampaign extends CreditCampaignInput {
  id: string;
  version: number;
  issued: number;
  resourceReserved: number;
  resourceUsed: number;
  updatedAt: string;
}
export interface ScopedCreditGrant {
  id: string;
  walletId: string;
  campaignId: string;
  campaignName: string;
  targetLabels: string[];
  campaignActive: boolean;
  targets: ModelBillingTarget[];
  amount: number;
  available: number;
  frozen: number;
  spent: number;
  expired: number;
  expiresAt: string;
  createdAt: string;
}
export interface ModelBillingAmounts { scopedCredits: number; walletCredits: number }
/** Read-only projection of the original charge/hold; released grants retain their original expiry. */
export interface ModelBillingBreakdown {
  spent: ModelBillingAmounts;
  pending: ModelBillingAmounts;
  released: ModelBillingAmounts;
}
export interface ModelBillingQuote {
  target: ModelBillingTarget;
  usage: ModelUsage;
  standardCredits: number;
  discountCredits: number;
  payableCredits: number;
  scopedCredits: number;
  walletCredits: number;
  discountName?: string | null;
  priceVersion: string;
  grantAllocations: { grantId: string; campaignId: string; credits: number }[];
  freeOnly: boolean;
  canAfford: boolean;
  unavailableCode?: string | null;
  unavailableReason?: string | null;
  approval: ModelBillingApproval;
}
/** An approved debit ceiling and resolved scope; never a client-defined selling price. */
export interface ModelBillingApproval {
  walletId: string;
  target: ModelBillingTarget;
  usage: ModelUsage;
  priceVersion: string;
  freeOnly: boolean;
  maxWalletCredits: number;
}
export interface ScopedGrantRequest {
  walletId: string;
  campaignId: string;
  amount: number;
  expiresAt: string;
  requestId: string;
  reason: string;
}
/** Shared approval queue for ordinary gifts and model-restricted grants. */
export interface CreditAdjustmentRequest {
  id: string;
  type: 'compensate' | 'grant' | 'scoped_grant';
  targetUserId: string;
  amount: number;
  reason?: string | null;
  incidentRef?: string | null;
  campaignId?: string | null;
  walletId?: string | null;
  expiresAt?: string | null;
  grantId?: string | null;
  status: 'pending_approval' | 'approved' | 'rejected';
  makerId: string;
  checkerId?: string | null;
  ledgerEntryId?: string | null;
  decideNote?: string | null;
  createdAt: string;
  decidedAt?: string | null;
}
