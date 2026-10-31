package com.aistareco.aep.billing;

import com.aistareco.aep.billing.model.*;
import com.aistareco.aep.billing.repository.*;
import com.aistareco.aep.billing.service.*;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ModelPricingServiceTest {
    private final ModelDiscountRepository discounts=mock(ModelDiscountRepository.class);
    private final ModelPricingService service=new ModelPricingService(discounts);
    private final ModelBillingTarget target=new ModelBillingTarget("aiavatar","image","provider-a","image-a","standard","image");
    private final Instant now=Instant.parse("2026-10-24T12:00:00Z");

    @Test void appliesOnlyOneBestDiscountAndDoesNotLeakPersonalContractToEnterpriseWallet() {
        var personal=discount("user", "user", "0.5");var enterprise=discount("enterprise","company","0.8");
        var all=discount("all",null,"0.9");
        when(discounts.findByTargetKeyAndActiveTrueOrderByIdAsc(target.endpointKey())).thenReturn(List.of(personal,enterprise,all));
        var individual=resolve(new ModelPricingService.Payer("personal","user",null));
        assertEquals(15,individual.payable(new ModelBillingMath.Usage(new BigDecimal("3"),null)));
        var company=resolve(new ModelPricingService.Payer("member","user","company"));
        assertEquals(24,company.payable(new ModelBillingMath.Usage(new BigDecimal("3"),null)));
        assertEquals(27,resolve(new ModelPricingService.Payer("other","other",null)).payable(new ModelBillingMath.Usage(new BigDecimal("3"),null)));
    }
    @Test void sumsFractionalUnitsBeforeRoundingAndKeepsTokenInputOutputSeparate() {
        var price=new ModelPricingService.Snapshot("v1",new BigDecimal("0.6"),new BigDecimal("1.2"),null,null,new BigDecimal("0.8"),true);
        var usage=new ModelBillingMath.Usage(new BigDecimal("1.5"),new BigDecimal("0.5"));
        assertEquals(2,price.standard(usage));assertEquals(2,price.payable(usage));
        var tiny=new ModelPricingService.Snapshot("v1",new BigDecimal("0.4"),null,null,null,BigDecimal.ONE,true);
        assertEquals(2,tiny.payable(new ModelBillingMath.Usage(new BigDecimal("3"),null)));
    }
    @Test void targetChangesForEveryScopeDimension() {
        assertNotEquals(target.key(),new ModelBillingTarget("drama","image","provider-a","image-a","standard","image").key());
        assertNotEquals(target.key(),new ModelBillingTarget("aiavatar","image","provider-b","image-a","standard","image").key());
        assertNotEquals(target.key(),new ModelBillingTarget("aiavatar","image","provider-a","image-b","standard","image").key());
        assertNotEquals(target.key(),new ModelBillingTarget("aiavatar","image","provider-a","image-a","high","image").key());
    }
    @Test void expiredDiscountDoesNotApply() {
        var expired=discount("all",null,"0.2");expired.setExpiresAt(now);
        when(discounts.findByTargetKeyAndActiveTrueOrderByIdAsc(target.endpointKey())).thenReturn(List.of(expired));
        assertEquals(10,resolve(new ModelPricingService.Payer("w","user",null)).payable(new ModelBillingMath.Usage(BigDecimal.ONE,null)));
    }
    @Test void partialUsageRoundsExactDiscountedCostRatherThanProratingRoundedReservation() {
        when(discounts.findByTargetKeyAndActiveTrueOrderByIdAsc(target.endpointKey())).thenReturn(List.of(discount("all",null,"0.5")));
        var snapshot=service.resolve(target,new ModelPricingService.Payer("w","user",null),BigDecimal.ONE,null,"v1",now);
        assertEquals(2,snapshot.payable(new ModelBillingMath.Usage(new BigDecimal("3"),null)));
        assertEquals(1,snapshot.payable(new ModelBillingMath.Usage(new BigDecimal("2"),null)));
        assertThrows(BusinessException.class,()->ModelBillingMath.factor(BigDecimal.ZERO));
    }
    @Test void standardPriceComesFromExistingEndpointPricing() {
        var payer=new ModelPricingService.Payer("w","user",null);
        assertEquals("MODEL_PRICE_NOT_CONFIGURED",assertThrows(BusinessException.class,
                ()->service.resolve(target,payer,BigDecimal.ZERO,null,"v1",now)).getCode());
        assertEquals(12,service.resolve(target,payer,BigDecimal.valueOf(12),null,"existing-endpoint-price",now)
                .standard(new ModelBillingMath.Usage(BigDecimal.ONE,null)));
    }
    @Test void enterpriseModelDiscountCoversEveryMemberAndSpecificationButNotPersonalFunds() {
        var contract=discount("enterprise","company","0.8");
        when(discounts.findByTargetKeyAndActiveTrueOrderByIdAsc(target.endpointKey())).thenReturn(List.of(contract));
        var high=new ModelBillingTarget("aiavatar","image","provider-a","image-a","high","image");
        for(String member:List.of("owner","existing-member","new-member")) {
            var payer=new ModelPricingService.Payer("member-wallet-"+member,member,"company");
            assertEquals(8,service.resolve(target,payer,BigDecimal.TEN,null,"v1",now).payable(new ModelBillingMath.Usage(BigDecimal.ONE,null)));
            assertEquals(8,service.resolve(high,payer,BigDecimal.TEN,null,"v1",now).payable(new ModelBillingMath.Usage(BigDecimal.ONE,null)));
            var script=new ModelBillingTarget("drama","script",target.endpointId(),"renamed-model","script","call");
            assertEquals(8,service.resolve(script,payer,BigDecimal.TEN,null,"v1",now).payable(new ModelBillingMath.Usage(BigDecimal.ONE,null)));
        }
        assertEquals(10,resolve(new ModelPricingService.Payer("personal","owner",null)).payable(new ModelBillingMath.Usage(BigDecimal.ONE,null)));
        assertEquals(10,resolve(new ModelPricingService.Payer("other","owner","other-company")).payable(new ModelBillingMath.Usage(BigDecimal.ONE,null)));
    }

    private ModelPricingService.Snapshot resolve(ModelPricingService.Payer payer) {
        return service.resolve(target,payer,new BigDecimal("10"),null,"existing-v1",now);
    }
    private ModelDiscount discount(String audience,String audienceId,String factor) {
        var d=new ModelDiscount();d.setId(audience);d.setAudience(audience);d.setAudienceId(audienceId);d.setFactor(new BigDecimal(factor));
        d.setStartsAt(now.minusSeconds(1));d.setExpiresAt(now.plusSeconds(60));d.setAllowGrants(true);d.setActive(true);return d;
    }
}
