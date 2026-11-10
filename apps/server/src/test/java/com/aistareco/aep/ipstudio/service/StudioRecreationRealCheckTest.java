package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.execution.StudioCheckOutcome;
import com.aistareco.aep.ipstudio.execution.StudioPlanOutputs;
import com.aistareco.aep.ipstudio.execution.StudioSkillRules;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiChatTokenPricing;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 爆款复刻的检查真跑一遍（不默认跑，要钱）：受理检查（按切镜抽帧、核对参考图、按提示词库拼检查提示词）和拼图走线上同一套代码，
 * 再交给线上同款文字模型（OneToken Terra），结果按 {@link StudioCheckOutcome#normalize} 整理。存储、归属、扣费是假的。
 * <pre>
 * STUDIO_REAL_CHECKS=/checks.json（[{id, target, prompt, checkIds, sampling?, references:[{label, path}]}]）
 * STUDIO_REAL_CHECKS_OUT=/results.json STUDIO_REAL_TEXT_KEY=...(OneToken) ./mvnw -Dtest=StudioRecreationRealCheckTest test
 * </pre>
 */
@EnabledIfEnvironmentVariable(named="STUDIO_REAL_CHECKS",matches=".+")
class StudioRecreationRealCheckTest {
    final ObjectMapper om=new ObjectMapper();
    final String base=env("STUDIO_REAL_TEXT_BASE","https://api.onetoken.love/v1"),model=env("STUDIO_REAL_TEXT_MODEL","gpt-6.1-terra-official");

    @Test
    void runRealChecks() throws Exception {
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        try {
            JsonNode jobs=om.readTree(Files.readString(Path.of(System.getenv("STUDIO_REAL_CHECKS"))));
            ArrayNode results=om.createArrayNode();
            for(JsonNode job:jobs)results.add(run(job));
            Files.writeString(Path.of(System.getenv("STUDIO_REAL_CHECKS_OUT")),om.writerWithDefaultPrettyPrinter().writeValueAsString(results));
            assertEquals(jobs.size(),results.size());
        } finally {
            org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private ObjectNode run(JsonNode job) throws Exception {
        String target=job.path("target").asText();
        var projects=mock(IpProjectService.class);var runs=mock(IpRunRepository.class);
        var project=IpProject.builder().id("p").build();
        when(projects.requiredForUpdate("u","p")).thenReturn(project);
        when(projects.readDoc(project)).thenReturn(om.readTree("{\"nodes\":[]}"));
        when(projects.requireOwnedAssetKey(eq("u"),anyString())).thenAnswer(i->i.getArgument(1));
        var output=om.createObjectNode();
        if(target.matches("(?i).*\\.(png|jpe?g|webp)$"))output.put("storageKey",target);
        else {output.putArray("videoCandidates").addObject().put("index",0).put("status","done").put("storageKey",target);output.put("storageKey",target);}
        var dto=new IpRunDto("IPR-t","p","n","studio-video","done","done",100,0,null,null,om.createObjectNode(),output,java.time.Instant.now().toString(),null,null);
        when(projects.ownedRun(eq("u"),eq("p"),eq("IPR-t"))).thenReturn(Optional.of(IpRun.builder().id("IPR-t").ownerUserId("u").projectId("p").build()));
        when(projects.toRunDto(any())).thenReturn(dto);
        when(projects.parseOrEmptyObject(any())).thenAnswer(i->i.getArgument(0)==null?om.createObjectNode():om.readTree((String)i.getArgument(0)));
        when(runs.findByProjectIdAndClientRequestId(anyString(),anyString())).thenReturn(Optional.empty());
        var models=mock(AiModelInvocationService.class);var pricing=mock(DapPricingService.class);
        when(pricing.ipIdentity()).thenReturn(2L);
        var endpoint=AiModelEndpoint.builder().id("ai-onetoken-sonnet55").enabled(true).model(model).modelsJson("[{\"id\":\""+model+"\",\"supportsVision\":true}]").build();
        when(models.resolveEndpoint(eq(AiModelPurpose.DAP_PERSONA),any(),eq("studio"))).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        var service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),mock(StudioWorkflowWorker.class),pricing,models,null,mock(CreditService.class),
                null,null,null,null,om,null,mock(PromptService.class));
        // 线上 Terra 的售价（ai.chat-token-pricing 第 11 版）
        var rate=new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.2111"),new java.math.BigDecimal("1.0553"),200000,64000);
        var tokenPricing=mock(AiChatTokenPricing.class);when(tokenPricing.find(anyString())).thenReturn(rate);
        ReflectionTestUtils.setField(service,"tokenPricing",tokenPricing);
        var storage=mock(FileStorageService.class);when(storage.openForRead(anyString())).thenAnswer(i->Path.of((String)i.getArgument(0)));
        ReflectionTestUtils.setField(service,"recreationStorage",storage);
        ReflectionTestUtils.setField(service,"hypitMedia",mock(StudioHypitMedia.class));
        ReflectionTestUtils.setField(service,"planOutputs",new StudioPlanOutputs(runs,projects,om));
        String file;try(var in=getClass().getResourceAsStream("/studio/skills/reference-video-recreation.md")){file=new String(in.readAllBytes(),StandardCharsets.UTF_8);}
        var catalog=mock(StudioSkillCatalog.class);when(catalog.requireForNewWork("reference-video-recreation")).thenReturn(StudioSkillCatalog.parse(file));
        @SuppressWarnings("unchecked") ObjectProvider<StudioSkillCatalog> catalogs=mock(ObjectProvider.class);when(catalogs.getIfAvailable()).thenReturn(catalog);
        ReflectionTestUtils.setField(service,"skillRules",new StudioSkillRules(catalogs));

        ObjectNode body=om.createObjectNode().put("clientRequestId","chk-"+job.path("id").asText()).put("nodeId","n-check").put("operation","check")
                .put("prompt",job.path("prompt").asText()).put("maxCost",rate.maxCost()).put("skillKey","reference-video-recreation");
        ObjectNode check=body.putObject("check").put("targetRunId","IPR-t");
        check.set("checkIds",job.path("checkIds"));
        if(job.hasNonNull("sampling"))check.put("sampling",job.path("sampling").asText());
        if(job.path("references").size()>0) {
            var refs=check.putArray("references");
            for(JsonNode r:job.path("references"))refs.addObject().put("label",r.path("label").asText()).put("storageKey",r.path("path").asText());
        }
        service.submit("u","p",om.treeToValue(body,RunRequest.class));
        var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());
        JsonNode exec=om.readTree(capture.getValue().getInputJson()).path("_exec");
        JsonNode checkTarget=exec.path("check");
        List<Double> times=new ArrayList<>();checkTarget.path("sampledTimesSec").forEach(t->times.add(t.asDouble()));
        List<StudioVisualContext.ShownReference> shown=new ArrayList<>();
        checkTarget.path("references").forEach(r->shown.add(new StudioVisualContext.ShownReference(r.path("label").asText(),r.path("storageKey").asText())));
        var parts=new StudioVisualContext(storage).targetParts(exec.path("userPrompt").asText(),checkTarget.path("targetStorageKey").asText(),
                "video".equals(checkTarget.path("mediaType").asText()),times,shown);

        Map<String,Object> request=new LinkedHashMap<>();
        request.put("model",model);request.put("max_tokens",exec.path("maxTokens").asInt(16000));request.put("temperature",exec.path("temperature").asDouble(.1));
        request.put("reasoning_effort","low");request.put("stream",true);request.put("stream_options",Map.of("include_usage",true));
        request.put("messages",List.of(Map.of("role","system","content",exec.path("systemPrompt").asText()),Map.of("role","user","content",parts)));
        long t0=System.currentTimeMillis();
        var response=HttpClient.newHttpClient().send(HttpRequest.newBuilder(URI.create(base+"/chat/completions")).timeout(Duration.ofMinutes(10))
                .header("Authorization","Bearer "+System.getenv("STUDIO_REAL_TEXT_KEY")).header("Content-Type","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(request))).build(),HttpResponse.BodyHandlers.ofString());
        ObjectNode out=om.createObjectNode().put("id",job.path("id").asText()).put("httpStatus",response.statusCode()).put("seconds",(System.currentTimeMillis()-t0)/1000);
        out.set("sampledTimesSec",checkTarget.path("sampledTimesSec"));out.put("shots",checkTarget.path("shots").asInt(0));
        out.put("references",checkTarget.path("references").size());out.put("userPrompt",exec.path("userPrompt").asText());
        if(response.statusCode()!=200){out.put("error",response.body().length()>600?response.body().substring(0,600):response.body());return out;}
        StringBuilder text=new StringBuilder();JsonNode usage=om.nullNode();
        for(String line:response.body().split("\n")) {
            if(!line.startsWith("data:"))continue;String data=line.substring(5).trim();if(data.equals("[DONE]"))continue;
            JsonNode chunk=om.readTree(data);if(chunk.has("usage")&&!chunk.path("usage").isNull())usage=chunk.path("usage");
            for(JsonNode c:chunk.path("choices"))text.append(c.path("delta").path("content").asText(""));
        }
        out.set("usage",usage);out.put("raw",text.toString());
        if(usage.isObject())out.put("credits",rate.settle(usage.path("prompt_tokens").asLong(),usage.path("completion_tokens").asLong()));
        try {
            List<String> ids=new ArrayList<>();checkTarget.path("checkIds").forEach(v->ids.add(v.asText()));
            out.set("result",StudioCheckOutcome.normalize(ModelJson.parse(om,text.toString()),ids,times,"image".equals(checkTarget.path("mediaType").asText()),
                    checkTarget.path("mediaFacts").size()>0,"IPR-t",checkTarget.path("targetStorageKey").asText()));
        } catch(Exception e) {
            out.put("parseError",e.toString());
        }
        return out;
    }

    private static String env(String name,String fallback){String v=System.getenv(name);return v==null||v.isBlank()?fallback:v;}
}
