package com.aistareco.aep.billing.service;

import com.aistareco.aep.billing.model.ModelDiscount;
import com.aistareco.aep.billing.repository.ModelDiscountRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Comparator;
import java.util.Objects;

/** One price/discount decision for both preview and reservation. Historical settlements use Snapshot. */
@Service
public class ModelPricingService {
    private final ModelDiscountRepository discounts;

    public ModelPricingService(ModelDiscountRepository discounts) {
        this.discounts=discounts;
    }

    public record Payer(String walletId, String userId, String enterpriseId) {}
    public record Snapshot(String priceVersion, BigDecimal unitPrice, BigDecimal outputUnitPrice,
                           String discountId, String discountName, BigDecimal factor, boolean allowGrants) {
        public Snapshot {
            unitPrice=ModelBillingMath.decimal(unitPrice,"单价");
            if(outputUnitPrice!=null)outputUnitPrice=ModelBillingMath.decimal(outputUnitPrice,"输出单价");
            factor=ModelBillingMath.factor(factor);
        }
        public long standard(ModelBillingMath.Usage usage) {
            return ModelBillingMath.credits(ModelBillingMath.cost(usage,unitPrice,outputUnitPrice));
        }
        public long payable(ModelBillingMath.Usage usage) {
            return ModelBillingMath.credits(ModelBillingMath.cost(usage,unitPrice,outputUnitPrice).multiply(factor));
        }
    }

    /** No configured price means the caller must supply its existing server-owned published rate. */
    public Snapshot resolve(ModelBillingTarget target, Payer payer, BigDecimal existingUnitPrice,
                            BigDecimal existingOutputUnitPrice, String existingVersion, Instant now) {
        BigDecimal unit=existingUnitPrice;
        BigDecimal output=existingOutputUnitPrice;
        if(unit==null || ("ktoken".equals(target.unit()) && output==null))
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"MODEL_PRICE_NOT_CONFIGURED","此模型规格尚未配置价格");
        if(unit.signum()==0&&(output==null||output.signum()==0))
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"MODEL_PRICE_NOT_CONFIGURED","请先配置有效的标准售价。想免费送用户体验，请发放模型赠款");
        if(!"ktoken".equals(target.unit()) && output!=null)
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE,"MODEL_PRICE_UNIT_MISMATCH","模型规格的计费单位与价格不一致");
        var applicable=discounts.findByTargetKeyAndActiveTrueOrderByIdAsc(target.endpointKey());
        ModelDiscount discount=applicable.stream()
                .filter(d->!now.isBefore(d.getStartsAt()) && now.isBefore(d.getExpiresAt()))
                .filter(d->matches(d,payer))
                .min(Comparator.comparing(ModelDiscount::getFactor).thenComparing(ModelDiscount::getId)).orElse(null);
        String version=existingVersion;
        if(version==null || version.isBlank())throw new IllegalArgumentException("price snapshot needs a version");
        return new Snapshot(version,unit,output,discount==null?null:discount.getId()+":"+discount.getVersion(),
                discount==null?null:discount.getName(),discount==null?BigDecimal.ONE:discount.getFactor(),
                true);
    }

    private static boolean matches(ModelDiscount d,Payer p) {
        return switch(d.getAudience()) {
            case "all" -> true;
            // A personal contract must not discount the employer's wallet (or vice versa).
            case "user" -> p.enterpriseId()==null && p.userId()!=null && Objects.equals(d.getAudienceId(),p.userId());
            case "enterprise" -> p.enterpriseId()!=null && Objects.equals(d.getAudienceId(),p.enterpriseId());
            default -> false;
        };
    }
}
