package com.aistareco.aep.billing.service;

import com.aistareco.common.BusinessException;

/** Mirror of the shared TS approval. This limits an owned account's debit; it never supplies the rate. */
public record ModelBillingApproval(String walletId,ModelBillingTarget target,ModelBillingMath.Usage usage,String priceVersion,boolean freeOnly,long maxWalletCredits) {
    public ModelBillingApproval {
        if(walletId==null||walletId.isBlank()||walletId.length()>255||target==null||usage==null||priceVersion==null||priceVersion.isBlank()||priceVersion.length()>256
                ||maxWalletCredits<0||maxWalletCredits>ModelBillingMath.MAX_CREDITS||freeOnly&&maxWalletCredits!=0)
            throw BusinessException.badRequest("MODEL_APPROVAL_INVALID","请重新确认模型报价");
    }
}
