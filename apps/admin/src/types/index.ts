// User
export type UserRole = 'fan' | 'producer' | 'coach' | 'platform_operator' | 'finance_admin';
export type UserStatus = 'active' | 'suspended' | 'deleted';
export type UserPlan = 'free' | 'pro' | 'enterprise';

export interface User {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  plan: UserPlan;
  credits: number;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

// Tenant
export type TenantType = 'personal' | 'organization' | 'channel';
export type TenantStatus = 'active' | 'suspended' | 'deleted';
export interface Tenant {
  id: string;
  name: string;
  type: TenantType;
  status: TenantStatus;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
}

// Membership
export interface Membership {
  id: string;
  tenantId: string;
  userId: string;
  tenantRole: string;
  joinedAt: string;
}

// Product
export interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
}

// Plan
export interface Plan {
  id: string;
  productId: string;
  code: string;
  name: string;
  monthlyPriceCents: number;
  annualPriceCents: number;
  enabled: boolean;
}

// Entitlement
export type EntitlementType =
  | 'feature_access'
  | 'seat_limit'
  | 'quota_limit'
  | 'monthly_credit'
  | 'addon'
  | 'singer_slot'
  | 'nft_mint_quota'
  | 'distribution_tier';
export type EntitlementStatus = 'active' | 'expired' | 'revoked';
export interface Entitlement {
  id: string;
  tenantId: string;
  productId: string;
  planId: string | null;
  entitlementType: EntitlementType;
  featureCode: string;
  value: string;
  validFrom: string;
  validTo: string | null;
  status: EntitlementStatus;
  createdAt: string;
}

// LicenseBatch
export type LicenseType = 'plan_activation' | 'credit_pack' | 'seat_expansion' | 'addon';
export type SettlementMode = 'prepaid' | 'on_activation';
export interface LicenseBatch {
  id: string;
  batchNo: string;
  productId: string;
  planId: string | null;
  licenseType: LicenseType;
  durationDays: number | null;
  creditDelta: number;
  settlementMode: SettlementMode;
  totalCount: number;
  activatedCount: number;
  channelPartnerId: string | null;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

// LicenseKey
export type LicenseKeyStatus =
  | 'created'
  | 'allocated'
  | 'sold'
  | 'activated'
  | 'expired'
  | 'revoked';
export interface LicenseKey {
  id: string;
  batchId: string;
  maskedCode: string;
  status: LicenseKeyStatus;
  activatedByUserId: string | null;
  activatedTenantId: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

// Wallet / Credits
export interface Wallet {
  id: string;
  tenantId: string;
  totalBalance: number;
  giftBalance: number;
  rechargeBalance: number;
  planBalance: number;
  createdAt: string;
  updatedAt: string;
}

export type LedgerEntryType = 'credit' | 'debit' | 'freeze' | 'unfreeze' | 'expire';
export interface LedgerEntry {
  id: string;
  walletId: string;
  tenantId: string;
  entryType: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  description: string;
  referenceId: string | null;
  referenceType: string | null;
  createdAt: string;
}

// AuditLog
export interface AuditLog {
  id: string;
  userId: string | null;
  tenantId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  result: 'success' | 'failure';
  detail: string | null;
  createdAt: string;
}

// API
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

// Dashboard Stats
export interface DashboardStats {
  totalUsers: number;
  activeTenants: number;
  activeLicenses: number;
  totalCreditsIssued: number;
  products: number;
  auditEvents: number;
}
