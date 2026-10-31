import type { CreditCampaign, CreditCampaignInput, ModelBillingEnterpriseOption, ModelBillingTargetOption, ModelBillingWalletOption, ModelBillingUserOption,
  ModelDiscount, ModelDiscountInput, ModelGrantConversionLine, ModelGrantConversionRequest, ModelPrice, ModelPriceInput, ScopedCreditGrant } from '@ai-star-eco/types';
import { apiFetch, apiFetchPage } from './_client';

const base = '/admin/model-billing';
export const targets = (signal?: AbortSignal) => apiFetch<ModelBillingTargetOption[]>(`${base}/targets`, { signal });
export const prices = (page = 0, signal?: AbortSignal) => apiFetchPage<ModelPrice>(`${base}/prices`, { query: { page, size: 20 }, signal });
export const discounts = (page = 0, signal?: AbortSignal) => apiFetchPage<ModelDiscount>(`${base}/discounts`, { query: { page, size: 20 }, signal });
export const campaigns = (page = 0, signal?: AbortSignal) => apiFetchPage<CreditCampaign>(`${base}/campaigns`, { query: { page, size: 20 }, signal });
export const grants = (walletId: string, page = 0, signal?: AbortSignal) => apiFetchPage<ScopedCreditGrant>(`${base}/grants`, { query: { walletId, page, size: 20 }, signal });
export const walletOptions = (q: string, accountType: string, page = 0, signal?: AbortSignal) =>
  apiFetchPage<ModelBillingWalletOption>(`${base}/wallet-options`, { query: { q, accountType, page, size: 10 }, signal });
export const userOptions = (q: string, page = 0, signal?: AbortSignal) =>
  apiFetchPage<ModelBillingUserOption>(`${base}/user-options`, { query: { q, page, size: 10 }, signal });
export const enterpriseOptions = (q: string, page = 0, signal?: AbortSignal) =>
  apiFetchPage<ModelBillingEnterpriseOption>(`${base}/enterprise-options`, { query: { q, page, size: 10 }, signal });
export const savePrice = (id: string | undefined, body: ModelPriceInput) => apiFetch<ModelPrice>(`${base}/prices${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body });
export const saveDiscount = (id: string | undefined, body: ModelDiscountInput) => apiFetch<ModelDiscount>(`${base}/discounts${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body });
export const conversionCandidates = (days: number, keep: number, signal?: AbortSignal) =>
  apiFetch<ModelGrantConversionLine[]>(`${base}/conversions/candidates`, { query: { days, keep }, signal });
export const previewConversion = (userIds: string[], keep: number) =>
  apiFetch<ModelGrantConversionLine[]>(`${base}/conversions/preview`, { method: 'POST', body: { userIds, keep } });
export const convertToGrant = (body: ModelGrantConversionRequest) => apiFetch<ModelGrantConversionLine[]>(`${base}/conversions`, { method: 'POST', body });
export const saveCampaign = (id: string | undefined, body: CreditCampaignInput) => apiFetch<CreditCampaign>(`${base}/campaigns${id ? `/${encodeURIComponent(id)}` : ''}`, { method: id ? 'PUT' : 'POST', body });
