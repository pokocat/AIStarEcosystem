package com.aistareco.aep.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;

class AiChatTokenPricingTest {
    final AiChatTokenPricing.Rate rate=new AiChatTokenPricing.Rate(new BigDecimal("0.18"),new BigDecimal("1.08"),65536,8192);
    @Test void roundsCombinedUsageOnceAndExposesSafeReservation() throws Exception {
        assertEquals(21,rate.maxCost());
        assertEquals(2,rate.settle(1000L,1000L));
        assertEquals(1,rate.settle(1L,1L));
        assertEquals(0,new AiChatTokenPricing.Rate(BigDecimal.ZERO,BigDecimal.ZERO,100,100).settle(1L,1L));
        var mapper=new ObjectMapper();var snapshot=mapper.valueToTree(rate);
        assertEquals(21,snapshot.path("maxCost").asLong());
        assertEquals(rate,mapper.treeToValue(snapshot,AiChatTokenPricing.Rate.class));
    }
    @Test void missingNegativeOrOverBudgetUsageCannotBecomeACharge() {
        for(Long[] usage:new Long[][]{{null,1L},{1L,null},{-1L,1L},{0L,0L},{65537L,1L},{1L,8193L}})
            assertThrows(BusinessException.class,()->rate.settle(usage[0],usage[1]));
    }
}
