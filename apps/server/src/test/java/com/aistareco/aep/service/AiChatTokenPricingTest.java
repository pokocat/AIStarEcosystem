package com.aistareco.aep.service;

import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import com.aistareco.aep.dto.PlatformConfigDto;
import com.aistareco.aep.repository.PlatformConfigRepository;
import java.math.BigDecimal;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

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

    @Test void operationOutputLimitReducesReservationWithoutChangingInputAllowance() {
        var deepseek=new AiChatTokenPricing.Rate(new BigDecimal("0.59"),new BigDecimal("2.36"),65536,100000);
        var extract=deepseek.limitOutputTokens(16384);
        assertEquals(65536,extract.maxInputTokens());
        assertEquals(16384,extract.maxOutputTokens());
        assertEquals(78,extract.maxCost());
        assertEquals(deepseek,deepseek.limitOutputTokens(120000));
        assertThrows(BusinessException.class,()->deepseek.limitOutputTokens(0));
    }

    @Test void dialogueHasRoomForMultipleCallsWithoutChangingTextPricesOrCeilings() throws Exception {
        var mapper=new ObjectMapper();
        var configs=mock(PlatformConfigService.class);
        when(configs.findByKey(AiChatTokenPricing.KEY)).thenReturn(Optional.of(new PlatformConfigDto(
                AiChatTokenPricing.KEY,mapper.readTree("{\"endpoints\":{\"ep\":{\"inputCreditsPerK\":0.18,\"outputCreditsPerK\":1.08,\"maxInputTokens\":65536,\"maxOutputTokens\":8192}}}"),1,null,null,null)));
        var pricing=new AiChatTokenPricing(configs);
        var dialogue=pricing.findDialogue("ep");
        assertEquals(rate,pricing.find("ep"));
        assertEquals(1_048_576,dialogue.maxInputTokens());
        assertEquals(65_536,dialogue.maxOutputTokens());
        assertEquals(rate.inputCreditsPerK(),dialogue.inputCreditsPerK());
        assertEquals(rate.outputCreditsPerK(),dialogue.outputCreditsPerK());
        assertEquals(260,dialogue.maxCost());
        assertEquals(58,dialogue.settle(200_000L,20_000L));
        assertThrows(BusinessException.class,()->rate.settle(200_000L,20_000L));
        assertThrows(BusinessException.class,()->dialogue.settle(1_048_577L,20_000L));
    }

    @Test void dialogueConfigHasGlobalAndEndpointLimitsAndAcceptedSnapshotsStayFixed() throws Exception {
        var mapper=new ObjectMapper();
        var configs=mock(PlatformConfigService.class);
        when(configs.findByKey(AiChatTokenPricing.KEY)).thenReturn(Optional.of(new PlatformConfigDto(
                AiChatTokenPricing.KEY,mapper.readTree("{\"endpoints\":{\"a\":{\"inputCreditsPerK\":1,\"outputCreditsPerK\":2,\"maxInputTokens\":10000,\"maxOutputTokens\":2000},\"b\":{\"inputCreditsPerK\":1,\"outputCreditsPerK\":2,\"maxInputTokens\":10000,\"maxOutputTokens\":2000}}}"),1,null,null,null)));
        var budget=mapper.readTree("{\"maxInputTokens\":500000,\"maxOutputTokens\":32000,\"endpoints\":{\"b\":{\"maxInputTokens\":900000,\"maxOutputTokens\":64000}}}");
        when(configs.findByKey(AiChatTokenPricing.DIALOGUE_BUDGET_KEY)).thenReturn(Optional.of(new PlatformConfigDto(AiChatTokenPricing.DIALOGUE_BUDGET_KEY,budget,1,null,null,null)));
        var pricing=new AiChatTokenPricing(configs);
        var accepted=mapper.valueToTree(pricing.findDialogue("b"));
        assertEquals(500000,pricing.findDialogue("a").maxInputTokens());
        assertEquals(32000,pricing.findDialogue("a").maxOutputTokens());
        assertEquals(900000,pricing.findDialogue("b").maxInputTokens());
        assertEquals(64000,pricing.findDialogue("b").maxOutputTokens());
        ((com.fasterxml.jackson.databind.node.ObjectNode)budget.path("endpoints").path("b")).put("maxInputTokens",1000000);
        assertEquals(1000000,pricing.findDialogue("b").maxInputTokens());
        assertEquals(900000,mapper.treeToValue(accepted,AiChatTokenPricing.Rate.class).maxInputTokens());
        assertEquals(14,pricing.find("b").maxCost());
        assertThrows(BusinessException.class,()->pricing.findDialogue("unpriced"));
    }

    @Test void invalidDialogueBudgetCannotBePersisted() throws Exception {
        var mapper=new ObjectMapper();
        var repo=mock(PlatformConfigRepository.class);
        var configs=new PlatformConfigService(repo,mapper);
        for(String value:new String[]{"null","{}","{\"maxInputTokens\":0,\"maxOutputTokens\":256}",
                "{\"maxInputTokens\":2000001,\"maxOutputTokens\":256}","{\"maxInputTokens\":10000,\"maxOutputTokens\":255}",
                "{\"maxInputTokens\":1.5,\"maxOutputTokens\":256}","{\"maxInputTokens\":10000,\"maxOutputTokens\":256,\"endpoints\":[]}",
                "{\"maxInputTokens\":10000,\"maxOutputTokens\":256,\"endpoints\":{\"bad\":{\"maxInputTokens\":0,\"maxOutputTokens\":256}}}"}) {
            var invalid=mapper.readTree(value);
            var error=assertThrows(BusinessException.class,()->configs.upsert(AiChatTokenPricing.DIALOGUE_BUDGET_KEY,invalid,null,"test"));
            assertEquals("STUDIO_DIALOGUE_BUDGET_INVALID",error.getCode());
        }
        verifyNoInteractions(repo);
    }
}
