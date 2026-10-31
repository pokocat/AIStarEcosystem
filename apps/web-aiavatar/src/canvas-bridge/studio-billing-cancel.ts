/** A payment/quote dialog closed before admission; never a supplier/task failure. */
export function isStudioBillingCancelled(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && error.code === 'STUDIO_BILLING_CANCELLED';
}
