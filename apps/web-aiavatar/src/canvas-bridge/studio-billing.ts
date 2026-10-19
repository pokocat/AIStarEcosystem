import { apiFetch } from "@ai-star-eco/api-client";
import type { IpModels } from "./api";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";

export type StudioBillingRequest = { clientRequestId?: string; billing?: EnterpriseBillingSelection | null; model?: string; maxCost?: number; operation?: string };
export type StudioBillingDetails = { operation?: string; expectedCost?: number; textUsage?: boolean; model?: string; libraryObjectId?: string };
export type BillingLookup = { found: boolean; billing?: EnterpriseBillingSelection | null };
const pending = new Map<string, Promise<EnterpriseBillingSelection | undefined>>();
const prefix = "ipstudio:payer:";

export function readSavedStudioBilling(key: string): EnterpriseBillingSelection | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(prefix + key) || "null");
    if (value?.mode === "personal") return { mode: "personal" };
    if (value?.mode === "enterprise" && typeof value.enterpriseId === "string") return { mode: "enterprise", enterpriseId: value.enterpriseId };
  } catch { /* The server remains authoritative when browser storage is unavailable. */ }
}

/** Resolve original requests before opening payment choice, preserving pre-enterprise replays exactly. */
export async function withStudioBilling<T extends object>(projectId: string, request: T, details: StudioBillingDetails = {}): Promise<T> {
  if (process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1") return request;
  const payerRequest = request as T & StudioBillingRequest;
  payerRequest.clientRequestId ||= crypto.randomUUID();
  const key = `${projectId}:${payerRequest.clientRequestId}`;
  let operation = pending.get(key);
  if (!operation) {
    operation = (async () => {
      if (payerRequest.clientRequestId) {
        const lookup = details.libraryObjectId
          ? await apiFetch<BillingLookup>(`/v1/ip-studio/library/objects/${encodeURIComponent(details.libraryObjectId)}/billing-selection`, { query: { clientRequestId: payerRequest.clientRequestId } })
          : await apiFetch<BillingLookup>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/billing-selection`, { query: { clientRequestId: payerRequest.clientRequestId } });
        if (lookup.found) return lookup.billing || undefined;
      }
      const remembered = readSavedStudioBilling(key);
      if (remembered) return remembered;
      const { chooseStudioBilling } = await import("@/ip/studio-billing-dialog");
      const billing = await chooseStudioBilling({ ...details, operation: details.operation || payerRequest.operation, expectedCost: details.expectedCost ?? payerRequest.maxCost, model: details.model || payerRequest.model });
      try { sessionStorage.setItem(prefix + key, JSON.stringify(billing)); } catch { /* Never change the payer because persistence failed. */ }
      return billing;
    })();
    pending.set(key, operation);
  }
  try {
    const billing = await operation;
    // Keep the original object used by canvas request snapshots in sync before submission.
    if (billing) payerRequest.billing = billing;
    else delete payerRequest.billing;
    return request;
  } finally { pending.delete(key); }
}

export async function legacyImageBillingDetails(doc: unknown, nodeId: string) {
  if (process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED !== "1") return {};
  const node = (doc as { nodes?: { id: string; metadata?: { model?: string; count?: number } }[] } | undefined)?.nodes?.find(item => item.id === nodeId);
  const choices = (await apiFetch<IpModels>("/v1/ip-studio/models")).image;
  const chosen = choices.find(model => model.endpointId === node?.metadata?.model) || choices.find(model => model.isDefault) || choices[0];
  return { model: chosen?.endpointId, expectedCost: chosen ? chosen.creditCost * (node?.metadata?.count || 1) : undefined };
}
