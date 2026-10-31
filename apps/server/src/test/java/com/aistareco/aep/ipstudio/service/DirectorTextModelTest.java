package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.*;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DirectorTextModelTest {
    final ObjectMapper om = new ObjectMapper();
    final IpRunRepository runs = mock(IpRunRepository.class);
    final AiModelInvocationService models = mock(AiModelInvocationService.class);
    final CreditService credits = mock(CreditService.class);
    final StudioWorkflowWorker worker = mock(StudioWorkflowWorker.class);
    final AiChatTokenPricing tokenPrices = mock(AiChatTokenPricing.class);
    final StudioWorkflowService service = spy(new StudioWorkflowService(mock(IpProjectService.class), runs,
            mock(StudioFixtureProvider.class), worker, mock(DapPricingService.class), models, null, credits, null, null, null, null, om, null, null));

    DirectorTextModelTest() { ReflectionTestUtils.setField(service, "tokenPricing", tokenPrices); }

    AiChatTokenPricing.Rate rate(String value) {
        return new AiChatTokenPricing.Rate(new BigDecimal(value), new BigDecimal(value).multiply(BigDecimal.TEN), 65536, 8192);
    }

    @Test void estimatesUseChosenRatesAndRespectFixedPolicy() {
        var ds = rate("0.01"); var qwen = rate("0.1"); var claude = rate("1");
        var choices = List.of(new TextModel("ds", "DS", true, false, 2L, ds),
                new TextModel("qwen", "Qwen", false, false, 2L, qwen), new TextModel("claude", "Claude", false, false, 2L, claude));
        doReturn(new Capabilities(false, List.of(), 16, 2, null, choices, "selectable", "fixed")).when(service).capabilities();
        assertEquals(ds.maxCost(), service.directorPrices(null)[0]);
        assertEquals(qwen.maxCost(), service.directorPrices("qwen")[0]);
        assertEquals(claude.maxCost(), service.directorPrices("claude")[0]);
        assertEquals(16, service.directorPrices("ds")[1]);
        // 每个任务按作品选择的端点预算冻结，不再按任务类型另设输出上限。
        assertEquals(claude.maxCost(), service.directorTextPrice("claude"));
        assertEquals(ds.maxCost(), service.directorTextPrice(null));
        assertThrows(BusinessException.class, () -> service.directorTextPrice("unknown"));
        assertThrows(BusinessException.class, () -> service.directorPrices("unknown"));
        doReturn(new Capabilities(false, List.of(), 16, 2, null, choices, "fixed", "fixed")).when(service).capabilities();
        assertThrows(BusinessException.class, () -> service.directorPrices("claude"));
    }

    @ParameterizedTest @ValueSource(strings = {"ds", "qwen", "claude"})
    void chosenEndpointAndRateAreFrozenAndRetryDoesNotChargeTwice(String model) throws Exception {
        var rate = rate(model.equals("ds") ? "0.01" : model.equals("qwen") ? "0.1" : "1");
        var endpoint = AiModelEndpoint.builder().id(model).enabled(true).build();
        var policies = mock(AiAppSceneModelPolicyService.class);
        ReflectionTestUtils.setField(service, "scenePolicies", policies);
        when(policies.resolve(eq("studio"), eq("script"), eq(model), anyLong()))
                .thenReturn(new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true), 2, "per_call"));
        when(tokenPrices.find(model)).thenReturn(rate);
        var meta = om.createObjectNode().put("task", "script");
        assertThrows(BusinessException.class, () -> service.submitDirectorText("u", "w", "script", "system", "user",
                "request", meta, model, null, rate.maxCost() - 1));
        verifyNoInteractions(credits, worker);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submitDirectorText("u", "w", "script", "system", "user", "request", meta, model, null, rate.maxCost());
            var capture = ArgumentCaptor.forClass(IpRun.class); verify(runs).save(capture.capture());
            var run = capture.getValue(); var exec = om.readTree(run.getInputJson()).path("_exec");
            assertEquals(model, exec.path("endpointId").asText());
            assertEquals(rate.maxCost(), run.getCost());
            assertEquals(0, rate.inputCreditsPerK().compareTo(exec.path("tokenPricing").path("inputCreditsPerK").decimalValue()));
            assertEquals(0, rate.outputCreditsPerK().compareTo(exec.path("tokenPricing").path("outputCreditsPerK").decimalValue()));
            assertEquals(rate.maxCost(), exec.path("tokenPricing").path("maxCost").asLong());
            verify(credits).hold(eq("u"), eq(rate.maxCost()), eq(IpRunService.REF_TYPE), eq(run.getId()), anyString(), any());
            verifyNoInteractions(worker);
            when(runs.findByProjectIdAndClientRequestId("w", "request")).thenReturn(Optional.of(run));
            service.submitDirectorText("u", "w", "script", "system", "user", "request", meta, model, null, rate.maxCost());
            assertEquals("STUDIO_REQUEST_CHANGED", assertThrows(BusinessException.class, () -> service.submitDirectorText("u", "w", "script", "system", "user",
                    "request", meta, "other", null, rate.maxCost())).getCode());
            verify(credits, times(1)).hold(anyString(), anyLong(), anyString(), anyString(), anyString(), any());
            TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit());
            verify(worker).execute(run.getId());
        } finally { TransactionSynchronizationManager.clearSynchronization(); }
    }
    @ParameterizedTest
    @CsvSource({"100000,100000,100000", "64000,100000,64000", "100000,32000,32000", "0,32000,32000", "0,0,8192"})
    void endpointSettingsDriveTheQuoteHoldAndAcceptedOutput(int requested,int cap,int expected) throws Exception {
        var endpoint=AiModelEndpoint.builder().id("ds").model("deepseek-flash").enabled(true)
                .defaultMaxTokens(requested==0?null:requested).chatMaxOutputTokens(cap==0?null:cap).build();
        var policies=mock(AiAppSceneModelPolicyService.class);
        ReflectionTestUtils.setField(service,"scenePolicies",policies);
        var selection=new AiAppSceneModelPolicyService.Selection(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true),2,"per_call");
        when(policies.resolve(eq("studio"),eq("script"),eq("ds"),anyLong())).thenReturn(selection);
        when(policies.available(eq("studio"),eq("script"),anyLong())).thenReturn(List.of(selection));
        when(tokenPrices.find("ds")).thenReturn(rate("0.59")); // 旧售价配置的输出预算仅 8192，端点可以显式扩展。
        var accepted=new AiChatTokenPricing.Rate(rate("0.59").inputCreditsPerK(),rate("0.59").outputCreditsPerK(),65536,expected);
        long quote=service.directorTextPrice("ds");
        assertEquals(accepted.maxCost(),quote);
        assertEquals(quote,service.directorPrices("ds")[0]);
        var meta=om.createObjectNode().put("task","plan");
        assertThrows(BusinessException.class,()->service.submitDirectorText("u","w","plan:e","system","user","request",meta,"ds",null,quote-1));
        verifyNoInteractions(credits,worker);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submitDirectorText("u","w","plan:e","system","user","request",meta,"ds",null,quote);
            var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());
            var run=capture.getValue();var exec=om.readTree(run.getInputJson()).path("_exec");
            assertEquals(expected,exec.path("maxTokens").asInt());
            assertEquals(expected,exec.path("tokenPricing").path("maxOutputTokens").asInt());
            assertEquals(quote,run.getCost());
            verify(credits).hold(eq("u"),eq(quote),eq(IpRunService.REF_TYPE),eq(run.getId()),anyString(),any());
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }

}
