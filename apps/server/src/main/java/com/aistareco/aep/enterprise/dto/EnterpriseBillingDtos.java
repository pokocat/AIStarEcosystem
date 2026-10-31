package com.aistareco.aep.enterprise.dto;

/** Billing mode is explicit for new requests. Null preserves legacy personal request fingerprints. */
public final class EnterpriseBillingDtos {
    private EnterpriseBillingDtos() {}
    public record BillingSelection(String mode,String enterpriseId) {}
    public record ReplaySelection(boolean found,BillingSelection billing,com.aistareco.aep.billing.service.ModelBillingApproval modelBilling) {
        public ReplaySelection(boolean found,BillingSelection billing){this(found,billing,null);}
    }
}
