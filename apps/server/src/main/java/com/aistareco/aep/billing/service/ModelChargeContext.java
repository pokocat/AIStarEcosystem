package com.aistareco.aep.billing.service;

import java.math.BigDecimal;

/** Explicit, resolved usage for every hold. NONE is reserved for operations without model usage. */
public record ModelChargeContext(ModelBillingTarget target, ModelBillingMath.Usage usage,
                                 BigDecimal unitPrice, BigDecimal outputUnitPrice, String priceVersion,
                                 boolean freeOnly, Long maxWalletCredits,ModelBillingApproval approval) {
    public static final ModelChargeContext NONE=new ModelChargeContext(null,null,null,null,null,false,null,null);

    /** Existing model pricing has already converted measured usage to platform credits. */
    public static ModelChargeContext forCredits(com.aistareco.aep.model.AiModelEndpoint endpoint,long credits) {
        if(endpoint==null||credits<=0)throw com.aistareco.common.BusinessException.badRequest("MODEL_PRICE_NOT_CONFIGURED","请先配置模型接入点与有效售价");
        return new ModelChargeContext(new ModelBillingTarget("endpoint","model",endpoint.getId(),ModelBillingTarget.providerModelOf(endpoint),"standard","credit"),
                new ModelBillingMath.Usage(BigDecimal.valueOf(credits),null),BigDecimal.ONE,null,"endpoint-credit-v1",false,credits,null);
    }

    public ModelChargeContext {
        if(target==null) {
            if(usage!=null || unitPrice!=null || outputUnitPrice!=null || priceVersion!=null || freeOnly || maxWalletCredits!=null || approval!=null)
                throw new IllegalArgumentException("Non-model operations cannot carry model billing options");
        } else {
            if("*".equals(target.specKey()))throw new IllegalArgumentException("A charge must resolve an exact model specification");
            if(approval!=null) {
                if(!target.equals(approval.target())||!usage.equals(approval.usage()))throw new com.aistareco.common.BusinessException(org.springframework.http.HttpStatus.CONFLICT,
                        "MODEL_QUOTE_CHANGED","模型或规格已变化，请重新确认报价");
                freeOnly=approval.freeOnly();maxWalletCredits=approval.maxWalletCredits();
            }
            if(usage==null || usage.total().signum()<=0 || priceVersion==null || priceVersion.isBlank())
                throw new IllegalArgumentException("Model billing needs measured/bounded usage and a price version");
            unitPrice=ModelBillingMath.decimal(unitPrice,"单价");
            if(outputUnitPrice!=null)outputUnitPrice=ModelBillingMath.decimal(outputUnitPrice,"输出单价");
            if(!"ktoken".equals(target.unit()) && usage.outputQuantity().signum()!=0)
                throw new IllegalArgumentException("Only token usage has output quantities");
            if(maxWalletCredits!=null && (maxWalletCredits<0 || maxWalletCredits>ModelBillingMath.MAX_CREDITS))
                throw new IllegalArgumentException("Invalid approved wallet debit");
        }
    }
}
