export type StudioIntegrationStatus = "linked" | "unavailable" | "stale" | "error" | string;
export type StudioHourlyOutcomeStatus = "ok" | "issue" | "active" | "no_calls" | "missing";

export interface StudioIntegrationState {
  status: StudioIntegrationStatus;
  observedAt: string | null;
  conclusion: string | null;
  note: string;
  href: string | null;
}

export interface StudioHourlyOutcome {
  hour: string;
  succeeded: number;
  failed: number;
  inFlight: number;
  status: StudioHourlyOutcomeStatus;
}

export interface StudioOperationsDashboard {
  generatedAt: string;
  timezone: string;
  window: { days: 1 | 7 | 30; startInclusive: string; endExclusive: string; label: string };
  health: {
    status: "healthy" | "issues" | "partial";
    checks: Array<{ id: string; label: string; count: number; status: "ok" | "issue"; detailAvailable: boolean }>;
    stuckHoldsOverSixHours: number;
    abnormalModels: number;
    reconciliationAgent: StudioIntegrationState;
  };
  business: {
    totals: { walletCredits: number; grantCredits: number; totalCredits: number; yuanEquivalent: number };
    dailySpend: Array<{ date: string; walletCredits: number; grantCredits: number }>;
    models: Array<{ endpointId: string; name: string; jobs: number; succeeded: number; refunded: number; inFlight: number; credits: number; walletCredits: number; grantCredits: number }>;
    features: Array<{ feature: string; jobs: number; succeeded: number; refunded: number; inFlight: number; credits: number }>;
    issuance: { issuedCredits: number; yuanEquivalent: number; walletBalance: number; grantAvailable: number; usageAttributionStatus: string; note: string };
  };
  technology: {
    models: Array<{ key: string; supplier: string; mediaType: string; jobs: number; succeeded: number; failed: number; inFlight: number; successRate: number | null; ownership: string; hourlyOutcomes: StudioHourlyOutcome[] }>;
    failureReasons: Array<{ category: string; label: string; count: number; ownership: string }>;
    imageLatency: StudioLatency;
    videoLatency: StudioLatency;
    queue: { queued: number; averageWaitSeconds: number | null; concurrencyRemaining: number | null; concurrencyStatus: string; pendingReconciliation: number; note: string };
    supplier: { platformRequestErrors: number; supplierErrors: number; unknownErrors: number; rateLimited: number | null; dailyUsage: number | null; quotaRemaining: number | null; quotaStatus: string };
  };
  integrations: { release: StudioIntegrationState; feishuAlerts: StudioIntegrationState; requestLogs: StudioIntegrationState };
}

export interface StudioLatency { mediaType: string; p50Seconds: number | null; p95Seconds: number | null; samples: number; note: string }
export interface StudioReconciliationDetailPage { checkId: string; items: Array<Record<string, string>>; page: number; size: number; total: number; hasMore: boolean }
export interface StudioCreditEventPage {
  items: Array<{ id: string; type: string; actor: string; beneficiary: string; credits: number; yuanEquivalent: number; reason: string; createdAt: string }>;
  page: number; size: number; total: number; hasMore: boolean;
}
