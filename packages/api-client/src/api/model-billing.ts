import { apiFetchPaginated } from '../_client';
import type { ScopedCreditGrant } from '@ai-star-eco/types/model-billing';

/** Current actor only; enterprise membership is verified by the server. */
export function myGrants(options: { enterpriseId?: string; page?: number; size?: number } = {}) {
  return apiFetchPaginated<ScopedCreditGrant>('/me/model-credits', { query: options });
}
