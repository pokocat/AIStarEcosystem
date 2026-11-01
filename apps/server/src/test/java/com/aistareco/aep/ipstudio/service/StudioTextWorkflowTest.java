package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.*;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTextWorkflowTest {
    final ObjectMapper json=new ObjectMapper();
    @Test void intentAndSourceAreFrozenWithConfiguredModelPriceBeforeAfterCommitDispatch() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);
        var credits=mock(CreditService.class);var pricing=mock(DapPricingService.class);var prompts=mock(PromptService.class);var worker=mock(StudioWorkflowWorker.class);
        var project=IpProject.builder().id("p").build();when(projects.requiredForUpdate("u","p")).thenReturn(project);
        when(projects.readDoc(project)).thenReturn(json.readTree("{\"nodes\":[{\"id\":\"text\",\"type\":\"text\",\"metadata\":{\"content\":\"原文\"}}]}"));
        when(runs.findByProjectIdAndClientRequestId(anyString(),anyString())).thenReturn(Optional.empty());when(pricing.ipIdentity()).thenReturn(2L);
        var endpoint=AiModelEndpoint.builder().id("agnes-text").model("text-v1").enabled(true).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt("assistant","{{input}}",new PromptParamsDto(null,null,null),"resource"));
        var service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),worker,pricing,models,null,credits,null,null,null,null,json,null,prompts);
        var prices=mock(AiChatTokenPricing.class);
        when(prices.find("agnes-text")).thenReturn(new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"),new java.math.BigDecimal("1.08"),65536,8192));
        org.springframework.test.util.ReflectionTestUtils.setField(service,"tokenPricing",prices);
        var request=json.readValue("{\"clientRequestId\":\"key\",\"nodeId\":\"text\",\"operation\":\"text\",\"prompt\":\"起一个标题\",\"model\":\"agnes-text\",\"maxCost\":21,\"textEdit\":{\"content\":\"原文\"}}",RunRequest.class);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submit("u","p",request);verifyNoInteractions(worker);
            var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());var run=capture.getValue();var input=json.readTree(run.getInputJson());
            assertEquals("text",run.getNodeId());assertEquals("studio-text",run.getKind());assertEquals("原文",input.path("textEdit").path("content").asText());
            assertEquals("agnes-text",input.path("_exec").path("endpointId").asText());assertTrue(input.path("_exec").path("userPrompt").asText().contains("起一个标题"));
            assertTrue(input.path("_exec").path("userPrompt").asText().contains("原文"));assertTrue(input.path("_exec").path("systemPrompt").asText().contains(StudioTextRevision.CONTRACT.strip()));
            assertEquals("stage-canvas-text",input.path("_exec").path("prompt").path("key").asText());
            var charge=ArgumentCaptor.forClass(com.aistareco.aep.billing.service.ModelChargeContext.class);
            verify(credits).hold(eq("u"),eq(21L),eq(IpRunService.REF_TYPE),eq(run.getId()),anyString(), charge.capture());
            assertEquals("model",charge.getValue().target().action());assertEquals("text-v1",charge.getValue().target().providerModel());
            TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());verify(worker).execute(run.getId());
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }
    /**
     * AI 视频页的编导（docs/studio-prompt-architecture.md §5.1）：文字任务带场景输入，system / user 由提示词库的编导环节拼，
     * 不再是通用助手模板加改稿句；受理时记下用到的各层版本和这次调用的摘要。
     */
    @Test void aSceneScriptRunIsAssembledFromThePromptLibraryAndRecordsTheVersions() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);
        var credits=mock(CreditService.class);var pricing=mock(DapPricingService.class);var prompts=mock(PromptService.class);var worker=mock(StudioWorkflowWorker.class);
        var project=IpProject.builder().id("p").build();when(projects.requiredForUpdate("u","p")).thenReturn(project);
        when(projects.readDoc(project)).thenReturn(json.readTree("{\"nodes\":[{\"id\":\"text\",\"type\":\"text\",\"metadata\":{\"content\":\"\"}}]}"));
        when(runs.findByProjectIdAndClientRequestId(anyString(),anyString())).thenReturn(Optional.empty());when(pricing.ipIdentity()).thenReturn(2L);
        var endpoint=AiModelEndpoint.builder().id("agnes-text").model("text-v1").enabled(true).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt("assistant","{{input}}",new PromptParamsDto(null,null,null),"resource"));
        var service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),worker,pricing,models,null,credits,null,null,null,null,json,null,prompts);
        var prices=mock(AiChatTokenPricing.class);
        when(prices.find("agnes-text")).thenReturn(new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"),new java.math.BigDecimal("1.08"),65536,8192));
        org.springframework.test.util.ReflectionTestUtils.setField(service,"tokenPricing",prices);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"sceneCatalog",new com.aistareco.aep.ipstudio.scene.StudioSceneCatalog());
        var request=json.readValue("{\"clientRequestId\":\"key\",\"nodeId\":\"text\",\"operation\":\"text\",\"prompt\":\"同城团购\",\"model\":\"agnes-text\",\"maxCost\":21,"
                +"\"textEdit\":{\"content\":\"\"},\"scene\":{\"kind\":\"video-script\",\"sceneId\":\"local-groupbuy\",\"text\":\"萧山公安路188号，锅盔原价19现价9.9\","
                +"\"imageTitles\":[\"门店门头.jpg\"],\"duration\":25,\"ratio\":\"9:16\",\"language\":\"中文\"}}",RunRequest.class);
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submit("u","p",request);
            var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());
            var exec=json.readTree(capture.getValue().getInputJson()).path("_exec");
            assertTrue(exec.path("systemPrompt").asText().contains("你是资深短视频编导"));
            assertTrue(exec.path("systemPrompt").asText().contains("客户没写到的价格"));
            assertFalse(exec.path("systemPrompt").asText().contains(StudioTextRevision.CONTRACT));
            String user=exec.path("userPrompt").asText();
            assertTrue(user.startsWith("写一条 25 秒的竖屏「同城团购」短视频脚本"));
            assertTrue(user.contains("我的要求：萧山公安路188号，锅盔原价19现价9.9"));
            assertTrue(user.contains("图1「门店门头.jpg」是门店照片"));
            assertFalse(user.contains("当前完整节点正文"));
            assertTrue(exec.path("prompt").path("versions").has("stage-scene-script"));
            assertTrue(exec.path("prompt").path("versions").has("scene-local-groupbuy"));
            assertEquals("stage-scene-script",exec.path("prompt").path("calls").get(0).path("stage").asText());
        } finally {TransactionSynchronizationManager.clearSynchronization();}
        // a scene input only rides on a plain text revision
        var wrong=(com.fasterxml.jackson.databind.node.ObjectNode)json.valueToTree(request);wrong.put("clientRequestId","k2");wrong.put("operation","assistant");wrong.remove("textEdit");
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(com.aistareco.common.BusinessException.class,()->service.submit("u","p",json.treeToValue(wrong,RunRequest.class))).getCode());
    }
    /** AI 视频页的编导看商品图写脚本：普通文字任务也能带 readVisuals；模型看不了图就按能力拒绝，不按操作类型拒绝。 */
    @Test void aTextRunMayReadTheReferencedPicturesWhenTheModelCanSee() throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);
        var credits=mock(CreditService.class);var pricing=mock(DapPricingService.class);var prompts=mock(PromptService.class);var worker=mock(StudioWorkflowWorker.class);
        var project=IpProject.builder().id("p").build();when(projects.requiredForUpdate("u","p")).thenReturn(project);
        when(projects.readDoc(project)).thenReturn(json.readTree("{\"nodes\":[{\"id\":\"text\",\"type\":\"text\",\"metadata\":{\"content\":\"\"}},"
                +"{\"id\":\"img\",\"type\":\"image\",\"title\":\"商品图 1\",\"metadata\":{\"storageKey\":\"ipstudio_media/u/p.png\"}}]}"));
        when(runs.findByProjectIdAndClientRequestId(anyString(),anyString())).thenReturn(Optional.empty());when(pricing.ipIdentity()).thenReturn(2L);
        var blind=AiModelEndpoint.builder().id("agnes-text").model("text-v1").enabled(true).build();
        var seeing=AiModelEndpoint.builder().id("agnes-text").model("text-v1").enabled(true).modelsJson("[{\"id\":\"text-v1\",\"supportsVision\":true}]").build();
        when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt("assistant","{{input}}",new PromptParamsDto(null,null,null),"resource"));
        var service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),worker,pricing,models,null,credits,null,null,null,null,json,null,prompts);
        var prices=mock(AiChatTokenPricing.class);
        when(prices.find("agnes-text")).thenReturn(new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"),new java.math.BigDecimal("1.08"),65536,8192));
        org.springframework.test.util.ReflectionTestUtils.setField(service,"tokenPricing",prices);
        var request=json.readValue("{\"clientRequestId\":\"key\",\"nodeId\":\"text\",\"operation\":\"text\",\"prompt\":\"写脚本\",\"model\":\"agnes-text\",\"maxCost\":21,"
                +"\"textEdit\":{\"content\":\"\"},\"contextNodeIds\":[\"img\"],\"readVisuals\":true}",RunRequest.class);
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(blind,null,true)));
        assertEquals("STUDIO_VISION_UNAVAILABLE",assertThrows(com.aistareco.common.BusinessException.class,()->service.submit("u","p",request)).getCode());
        verifyNoInteractions(credits);
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(seeing,null,true)));
        TransactionSynchronizationManager.initSynchronization();
        try {
            service.submit("u","p",request);
            var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());
            var exec=json.readTree(capture.getValue().getInputJson()).path("_exec");
            assertEquals("ipstudio_media/u/p.png",exec.path("visualContext").get(0).path("storageKey").asText());
            verify(projects).requireOwnedAssetKey("u","ipstudio_media/u/p.png");
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }
    @ParameterizedTest @ValueSource(strings={"text","script","storyboard","assistant","asset-extract"})
    void everyTextOperationFreezesTokenRateAndRejectsUnpricedOrOutdatedRequests(String operation) throws Exception {
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);
        var credits=mock(CreditService.class);var pricing=mock(DapPricingService.class);var prompts=mock(PromptService.class);var worker=mock(StudioWorkflowWorker.class);
        var project=IpProject.builder().id("p").build();when(projects.requiredForUpdate("u","p")).thenReturn(project);
        when(projects.readDoc(project)).thenReturn(json.readTree("{\"nodes\":[{\"id\":\"text\",\"type\":\"text\",\"metadata\":{\"content\":\"原文\"}}]}"));
        when(runs.findByProjectIdAndClientRequestId(anyString(),anyString())).thenReturn(Optional.empty());when(pricing.ipIdentity()).thenReturn(2L);
        var endpoint=AiModelEndpoint.builder().id("agnes-text").model("text-v1").enabled(true).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA,"agnes-text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt("assistant","{{input}}",new PromptParamsDto(null,null,null),"resource"));
        var service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),worker,pricing,models,null,credits,null,null,null,null,json,null,prompts);
        var tokenPricing=mock(AiChatTokenPricing.class);
        var rate=new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"),new java.math.BigDecimal("1.08"),65536,8192);
        when(tokenPricing.find("agnes-text")).thenReturn(rate);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"tokenPricing",tokenPricing);
        var request=json.readValue("{\"clientRequestId\":\"key\",\"nodeId\":\"text\",\"operation\":\"assistant\",\"prompt\":\"起一个标题\",\"model\":\"agnes-text\",\"maxCost\":21}",RunRequest.class);
        var body=(com.fasterxml.jackson.databind.node.ObjectNode)json.valueToTree(request);
        body.put("operation",operation);
        if("text".equals(operation))body.putObject("textEdit").put("content","原文");
        if("asset-extract".equals(operation))body.putObject("scriptEdit").put("markdown","剧本正文");
        request=json.treeToValue(body,RunRequest.class);
        TransactionSynchronizationManager.initSynchronization();
        try {
            when(tokenPricing.find("agnes-text")).thenReturn(null);
            var missing=request;
            assertEquals("AI_TOKEN_PRICE_NOT_CONFIGURED",assertThrows(com.aistareco.common.BusinessException.class,()->service.submit("u","p",missing)).getCode());
            verifyNoInteractions(credits);
            when(tokenPricing.find("agnes-text")).thenReturn(rate);
            var stale=json.valueToTree(request);((com.fasterxml.jackson.databind.node.ObjectNode)stale).put("maxCost",2);
            assertThrows(com.aistareco.common.BusinessException.class,()->service.submit("u","p",json.treeToValue(stale,RunRequest.class)));
            verifyNoInteractions(credits);
            service.submit("u","p",request);verifyNoInteractions(worker);
            var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());var run=capture.getValue();var input=json.readTree(run.getInputJson());
            assertEquals("studio-"+operation,run.getKind());assertEquals(21,run.getCost());
            assertEquals("per_token",input.path("_exec").path("billingUnit").asText());
            assertEquals(21,input.path("_exec").path("tokenPricing").path("maxCost").asInt());
            assertTrue(input.path("_exec").path("maxTokens").asInt()<=8192);
            assertEquals("model",input.path("_exec").path("modelCharge").path("target").path("action").asText());
            assertEquals("text-v1",input.path("_exec").path("modelCharge").path("target").path("providerModel").asText());
            assertEquals("credit",input.path("_exec").path("modelCharge").path("target").path("unit").asText());
            verify(credits).hold(eq("u"),eq(21L),eq(IpRunService.REF_TYPE),eq(run.getId()),anyString(), org.mockito.ArgumentMatchers.any(com.aistareco.aep.billing.service.ModelChargeContext.class));
            when(runs.findByProjectIdAndClientRequestId("p","key")).thenReturn(Optional.of(run));
            when(tokenPricing.find("agnes-text")).thenReturn(null);
            service.submit("u","p",request);
            verify(credits,times(1)).hold(eq("u"),eq(21L),eq(IpRunService.REF_TYPE),eq(run.getId()),anyString(), org.mockito.ArgumentMatchers.any(com.aistareco.aep.billing.service.ModelChargeContext.class));
            TransactionSynchronizationManager.getSynchronizations().forEach(s->s.afterCommit());verify(worker).execute(run.getId());
        } finally {TransactionSynchronizationManager.clearSynchronization();}
    }
    @Test void providerRevisionSettlesOnceAndBadOutputReleasesTheHold() throws Exception {
        for(boolean invalid:new boolean[]{false,true}) {
            var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);var credits=mock(CreditService.class);var tx=mock(PlatformTransactionManager.class);
            when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
            var run=IpRun.builder().id("r").kind("studio-text").status("running").cost(2).inputJson("{\"operation\":\"text\",\"textEdit\":{\"content\":\"原文\"},\"_exec\":{\"systemPrompt\":\"text\",\"userPrompt\":\"起标题 + 原文\",\"endpointId\":\"text\"}}").build();
            when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));
            var endpoint=AiModelEndpoint.builder().id("text").enabled(true).build();when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA,"text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
            when(models.invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),anyList(),anyMap())).thenReturn(new AiModelInvocationService.AiModelResponse(invalid?"{}":"{\"summary\":\"添加标题\",\"content\":\"雨夜\\n原文\"}","stop",12L,"text","text"));
            var worker=new StudioWorkflowWorker(runs,mock(StudioFixtureProvider.class),mock(FileStorageService.class),models,mock(DramaAssembleService.class),credits,json,tx,mock(DapAssetService.class));
            worker.runBlocking("r");worker.runBlocking("r");verify(models,times(1)).invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),anyList(),anyMap());
            if(invalid){assertEquals("failed",run.getStatus());assertEquals("AI_BAD_OUTPUT",run.getErrorCode());assertEquals(0,run.getCost());verify(credits).releaseHold(anyString(),eq("r"),anyString());verify(credits,never()).commitHold(anyString(),anyString(),anyLong(),anyString(), org.mockito.ArgumentMatchers.any());}
            else {assertEquals("done",run.getStatus());assertEquals("雨夜\n原文",json.readTree(run.getOutputJson()).path("textRevision").path("content").asText());verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(2L),anyString(), org.mockito.ArgumentMatchers.any());}
        }
    }
    @Test void tokenUsageSettlesAcceptedSnapshotOnceAndRefundsTheRemainder() throws Exception {
        for(boolean missingUsage:new boolean[]{false,true}) {
            var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);var credits=mock(CreditService.class);var tx=mock(PlatformTransactionManager.class);
            when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
            var input=json.createObjectNode().put("operation","text");input.putObject("textEdit").put("content","原文");
            var execution=input.putObject("_exec").put("systemPrompt","text").put("userPrompt","修改").put("endpointId","text");
            execution.set("tokenPricing",json.valueToTree(new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"),new java.math.BigDecimal("1.08"),65536,8192)));
            var run=IpRun.builder().id("r").kind("studio-text").status("running").cost(21).inputJson(input.toString()).build();
            when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));
            var endpoint=AiModelEndpoint.builder().id("text").enabled(true).build();when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA,"text","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
            when(models.invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),anyList(),anyMap())).thenReturn(new AiModelInvocationService.AiModelResponse("{\"summary\":\"完成\",\"content\":\"新正文\"}","stop",2000L,"text","text",missingUsage?null:1000L,1000L));
            var worker=new StudioWorkflowWorker(runs,mock(StudioFixtureProvider.class),mock(FileStorageService.class),models,mock(DramaAssembleService.class),credits,json,tx,mock(DapAssetService.class));
            worker.runBlocking("r");worker.runBlocking("r");
            verify(models,times(1)).invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),anyList(),anyMap());
            verify(credits,times(1)).releaseHold(anyString(),eq("r"),anyString());
            if(missingUsage){assertEquals("failed",run.getStatus());assertEquals("AI_USAGE_MISSING",run.getErrorCode());assertEquals(0,run.getCost());verify(credits,never()).commitHold(anyString(),anyString(),anyLong(),anyString(), org.mockito.ArgumentMatchers.any());}
            else {assertEquals("done",run.getStatus());assertEquals(2,run.getCost());assertEquals(1000,json.readTree(run.getOutputJson()).path("billing").path("inputTokens").asInt());verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(2L),anyString(), org.mockito.ArgumentMatchers.any());}
        }
    }

    @Test void customerCatalogUsesOnlyConfiguredAliasesInBothPolicyPaths() {
        var models=mock(AiModelInvocationService.class);var pricing=mock(DapPricingService.class);
        var endpoint=AiModelEndpoint.builder().id("text").name("供应商 · 内部端点")
                .modelAlias("qwen3-6-35b-a3b").enabled(true).build();
        var candidate=AiAppEndpointCandidate.builder().enabled(true).build();
        var resolved=new AiModelInvocationService.ResolvedEndpoint(endpoint,candidate,true);
        when(models.listCandidates(AiModelPurpose.DAP_PERSONA,"studio")).thenReturn(List.of(resolved));
        var service=new StudioWorkflowService(null,null,mock(StudioFixtureProvider.class),null,pricing,models,null,null,null,null,null,null,json,null,null);
        assertEquals("qwen3-6-35b-a3b",service.capabilities().textModels().get(0).name());
        var policies=mock(AiAppSceneModelPolicyService.class);
        when(policies.available(eq("studio"),eq("script"),anyLong())).thenReturn(List.of(new AiAppSceneModelPolicyService.Selection(resolved,2L,"per_call")));
        org.springframework.test.util.ReflectionTestUtils.setField(service,"scenePolicies",policies);
        assertEquals("qwen3-6-35b-a3b",service.capabilities().textModels().get(0).name());
        endpoint.setModelAlias(null);
        assertEquals("未命名模型",service.capabilities().textModels().get(0).name());
    }

}
