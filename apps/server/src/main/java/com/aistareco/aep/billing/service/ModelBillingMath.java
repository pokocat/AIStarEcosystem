package com.aistareco.aep.billing.service;

import com.aistareco.common.BusinessException;
import java.math.BigDecimal;
import java.math.RoundingMode;

/** Decimal rates, integer wallet credits. Rounding happens on cumulative charges, never per chunk. */
public final class ModelBillingMath {
    public static final long MAX_CREDITS = 9_007_199_254_740_991L;
    private ModelBillingMath() {}

    public record Usage(BigDecimal quantity, BigDecimal outputQuantity) {
        public Usage {
            quantity = decimal(quantity,"用量");
            outputQuantity = decimal(outputQuantity == null ? BigDecimal.ZERO : outputQuantity,"输出用量");
        }
        public BigDecimal total() { return quantity.add(outputQuantity); }
    }

    public static BigDecimal decimal(BigDecimal value, String label) {
        if (value == null || value.signum()<0 || value.stripTrailingZeros().scale()>9
                || value.compareTo(BigDecimal.valueOf(MAX_CREDITS))>0)
            throw BusinessException.badRequest("MODEL_BILLING_NUMBER_INVALID",label+"无效，最多支持九位小数");
        return value.stripTrailingZeros();
    }

    public static BigDecimal factor(BigDecimal value) {
        if(value==null || value.signum()<=0 || value.compareTo(BigDecimal.ONE)>0 || value.stripTrailingZeros().scale()>6)
            throw BusinessException.badRequest("MODEL_DISCOUNT_INVALID","折扣要大于 0 且不高于原价。想免费送用户体验，请发放模型赠款");
        return value.stripTrailingZeros();
    }

    public static long credits(BigDecimal amount) {
        if(amount.signum()<0 || amount.compareTo(BigDecimal.valueOf(MAX_CREDITS))>0)
            throw BusinessException.badRequest("MODEL_BILLING_AMOUNT_INVALID","本次积分金额超出可计费范围");
        return amount.setScale(0,RoundingMode.CEILING).longValueExact();
    }

    public static BigDecimal cost(Usage usage, BigDecimal unitPrice, BigDecimal outputUnitPrice) {
        var input=decimal(unitPrice,"单价");
        if (usage.outputQuantity().signum()>0 && outputUnitPrice==null)
            throw BusinessException.badRequest("MODEL_OUTPUT_PRICE_REQUIRED","请配置输出用量单价");
        return usage.quantity().multiply(input).add(usage.outputQuantity()
                .multiply(outputUnitPrice==null?BigDecimal.ZERO:decimal(outputUnitPrice,"输出单价")));
    }

}
