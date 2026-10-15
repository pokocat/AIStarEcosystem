package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** All text entry semantics share the real admission path, including immutable payer retries. */
class StudioEnterpriseWorkflowTest {
    @ParameterizedTest @ValueSource(strings={"text","script","storyboard","assistant","asset-extract"})
    void eachTextEntryAuthorizesItsFinalEndpointAndImmutableEnterprisePayer(String operation) throws Exception {
        var json=new ObjectMapper();var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);
        var worker=mock(StudioWorkflowWorker.class);var prices=mock(DapPricingService.class);var models=mock(AiModelInvocationService.class);
        var credits=mock(CreditService.class);var prompts=mock(PromptService.class);var billing=mock(EnterpriseBillingService.class);
        var project=IpProject.builder().id("p").build();when(projects.requiredForUpdate("actor","p")).thenReturn(project);
        when(projects.readDoc(project)).thenReturn(json.readTree("{\"nodes\":[{\"id\":\"n\",\"type\":\"text\",\"metadata\":{\"content\":\"原文\"}}]}"));
        var saved=new AtomicReference<IpRun>();
        when(runs.findByProjectIdAndClientRequestId("p","key")).thenAnswer(i->Optional.ofNullable(saved.get()));
        when(runs.save(any())).thenAnswer(i->{saved.set(i.getArgument(0));return saved.get();});
        when(prices.ipIdentity()).thenReturn(2L);
        var endpoint=AiModelEndpoint.builder().id("final-text").enabled(true).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"chosen","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt("创作","{{input}}",new PromptParamsDto(null,null,null),"resource"));
        var tokenPrices=mock(AiChatTokenPricing.class);var rate=new AiChatTokenPricing.Rate(new BigDecimal("0.18"),new BigDecimal("1.08"),65536,8192);
        when(tokenPrices.find("final-text")).thenReturn(rate);
        var service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),worker,prices,models,null,credits,null,null,null,null,json,null,prompts);
        ReflectionTestUtils.setField(service,"enterpriseBilling",billing);ReflectionTestUtils.setField(service,"tokenPricing",tokenPrices);
        var selected=new BillingSelection("enterprise","company");
        when(billing.reserve(eq("actor"),eq(selected),eq("ip-run"),anyString(),eq("final-text"),eq(21L),anyString()))
                .thenReturn(new EnterpriseBillingService.BillingAccount("member-wallet","company","membership-v1","authorization"));
        var body=json.createObjectNode().put("clientRequestId","key").put("nodeId","n").put("operation",operation)
                .put("prompt","创作内容").put("model","chosen").put("maxCost",21);
        body.set("billing",json.valueToTree(selected));
        if("text".equals(operation))body.putObject("textEdit").put("content","原文");
        if("asset-extract".equals(operation))body.putObject("scriptEdit").put("markdown","剧本正文");
        var request=json.treeToValue(body,RunRequest.class);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submit("actor","p",request);
            assertEquals("studio-"+operation,saved.get().getKind());assertEquals("member-wallet",saved.get().getBillingWalletId());
            assertEquals("membership-v1",saved.get().getMembershipId());verifyNoInteractions(credits,worker);
            reset(models,tokenPrices);service.submit("actor","p",request);verifyNoInteractions(models,tokenPrices);
            body.remove("billing");
            assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.submit("actor","p",json.treeToValue(body,RunRequest.class))).getCode());
            verify(billing,times(1)).reserve(anyString(),any(),anyString(),anyString(),anyString(),anyLong(),anyString());
            TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());verify(worker).execute(saved.get().getId());
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }
}
