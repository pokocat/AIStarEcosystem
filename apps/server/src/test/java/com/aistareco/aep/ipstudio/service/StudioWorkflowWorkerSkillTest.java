package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapAssetService;
import com.aistareco.aep.ipstudio.dialogue.StudioDialogueEvents;
import com.aistareco.aep.ipstudio.execution.StudioPlanExecutor;
import com.aistareco.aep.ipstudio.execution.StudioPlanQuoter;
import com.aistareco.aep.ipstudio.execution.StudioSkillRules;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Worker side of the native check and skill planning runs: grounded verdicts, server quotes, token settlement, wake-up. */
class StudioWorkflowWorkerSkillTest {
    final ObjectMapper json=new ObjectMapper();@TempDir Path directory;
    final AiChatTokenPricing.Rate rate=new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"),new java.math.BigDecimal("1.08"),65536,8192);

    record Harness(StudioWorkflowWorker worker,IpRun run,CreditService credits,AiModelInvocationService models) {}
    Harness harness(ObjectNode input,String kind,String reply,FileStorageService storage) {
        var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);var credits=mock(CreditService.class);var tx=mock(PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        input.with("_exec").put("systemPrompt","system").put("userPrompt","user").put("endpointId","vision").set("tokenPricing",json.valueToTree(rate));
        var run=IpRun.builder().id("r").projectId("p").ownerUserId("u").kind(kind).status("running").cost(21).inputJson(input.toString()).build();
        when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));
        var endpoint=AiModelEndpoint.builder().id("vision").enabled(true).model("m").modelsJson("[{\"id\":\"m\",\"supportsVision\":true}]").build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"vision","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_PERSONA,"vision","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(models.invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_PERSONA),anyList(),anyMap())).thenReturn(new AiModelInvocationService.AiModelResponse(reply,"stop",2000L,"m","m",1000L,1000L));
        var worker=new StudioWorkflowWorker(runs,mock(StudioFixtureProvider.class),storage,models,mock(DramaAssembleService.class),credits,json,tx,mock(DapAssetService.class));
        return new Harness(worker,run,credits,models);
    }

    @Test void invalidModelContentKeepsTheExactSupplierResponseForTheAlert() throws Exception {
        var input=json.createObjectNode().put("operation","text");
        var h=harness(input,"studio-text","invalid JSON",mock(FileStorageService.class));
        var evidence=com.aistareco.aep.service.ai.ProviderResponseDiagnostics.capture(200,
                java.net.http.HttpHeaders.of(Map.of("x-request-id",List.of("supplier-123")),(k,v)->true),
                "{\"choices\":[{\"message\":{\"content\":\"invalid JSON\"}}]}");
        when(h.models().invokeChatOnEndpoint(any(),any(),anyList(),anyMap())).thenReturn(
                new AiModelInvocationService.AiModelResponse("invalid JSON","stop",1L,"ep","m",1L,0L,evidence));
        var errors=mock(StudioRunErrorLog.class);ReflectionTestUtils.setField(h.worker(),"errorLog",errors);
        h.worker().runBlocking("r");
        assertEquals("failed",h.run().getStatus());
        var failure=ArgumentCaptor.forClass(Throwable.class);verify(errors).attach(eq(h.run()),failure.capture());
        assertSame(evidence,failure.getValue().getSuppressed()[0]);
        assertTrue(evidence.responseBody().contains("invalid JSON"));
        verify(h.credits()).releaseHold(anyString(),eq("r"),anyString());
        verify(h.credits(),never()).commitHold(anyString(),anyString(),anyLong(),anyString());
    }

    @Test void checkRunSamplesTheRecordedTimesKeepsUnknownAndSettlesRealTokens() throws Exception {
        Path clip=directory.resolve("made.mp4");
        var ffmpeg=new ProcessBuilder("ffmpeg","-v","error","-y","-f","lavfi","-i","testsrc2=s=160x90:r=10:d=8","-c:v","libx264","-threads","2",clip.toString()).start();
        assertTrue(ffmpeg.waitFor(30,TimeUnit.SECONDS));assertEquals(0,ffmpeg.exitValue());
        var storage=mock(FileStorageService.class);when(storage.openForRead("made.mp4")).thenReturn(clip);
        var input=json.createObjectNode().put("operation","check");
        input.putObject("dialogue").put("threadId","t").put("messageId","m");
        var check=input.putObject("_exec").putObject("check").put("targetRunId","IPR-video").put("targetStorageKey","made.mp4").put("mediaType","video");
        check.putArray("checkIds").add("subject-replaced").add("dialogue-and-subtitles");check.putArray("sampledTimesSec").add(1.0).add(3.0).add(5.0).add(7.0);
        check.putObject("mediaFacts").put("durationSec",8);
        var h=harness(input,"studio-check","{\"status\":\"pass\",\"items\":[{\"id\":\"subject-replaced\",\"status\":\"pass\",\"evidence\":[{\"kind\":\"frame\",\"timeSec\":3,\"observation\":\"手中是新杯子\"}],\"reason\":\"已替换\"},"
                +"{\"id\":\"dialogue-and-subtitles\",\"status\":\"pass\",\"evidence\":[{\"kind\":\"frame\",\"timeSec\":2.2,\"observation\":\"编造\"}],\"reason\":\"猜测\"}]}",storage);
        var events=new ArrayList<String>();StudioDialogueEvents sink=(thread,turn,run,execution,type,data)->{events.add(type+"@"+thread+"/"+turn);return 1;};
        @SuppressWarnings("unchecked") ObjectProvider<StudioDialogueEvents> provider=mock(ObjectProvider.class);when(provider.getIfAvailable()).thenReturn(sink);
        ReflectionTestUtils.setField(h.worker(),"dialogueEvents",provider);
        h.worker().runBlocking("r");
        assertEquals("done",h.run().getStatus());
        JsonNode result=json.readTree(h.run().getOutputJson()).path("check");
        assertEquals("unknown",result.path("status").asText());assertEquals("pass",result.path("items").get(0).path("status").asText());
        assertEquals("unknown",result.path("items").get(1).path("status").asText(),"evidence at a time that was never sampled is dropped");
        var messages=ArgumentCaptor.forClass(List.class);verify(h.models()).invokeChatOnEndpoint(any(),any(),messages.capture(),anyMap());
        String sent=messages.getValue().toString();
        assertTrue(sent.contains("时间 3.00 秒")&&sent.contains("时间 7.00 秒"),"the model sees exactly the recorded sample times");
        long expected=rate.settle(1000L,1000L);
        verify(h.credits()).commitHold(anyString(),eq("r"),eq(expected),anyString());
        assertEquals(List.of("check.result@t/m"),events);
    }

    @Test void skillPlanRunIsValidatedQuotedAndFingerprintedAndWakesItsExecution() throws Exception {
        String file;try(var in=getClass().getResourceAsStream("/studio/skills/reference-video-recreation.md")){file=new String(in.readAllBytes(),StandardCharsets.UTF_8);}
        var rules=StudioSkillRules.rules(StudioSkillCatalog.parse(file));
        var input=json.createObjectNode().put("operation","text");
        var exec=input.putObject("_exec").put("skillPlan",true).put("planStage","analysis").put("planRevision",4);
        exec.set("skill",StudioSkillRules.snapshot(rules));exec.putArray("allowedNodeIds").add("src");
        exec.putObject("execution").put("executionId","PEX-1").put("stepId","compile").put("stage","analysis");
        var h=harness(input,"studio-text","{\"summary\":\"先拉片\",\"steps\":[{\"id\":\"cut\",\"operation\":\"recreation\",\"title\":\"拉片\",\"prompt\":\"看结构\",\"quotedCost\":1,"
                +"\"settings\":{\"sourceNodeId\":\"src\",\"mode\":\"segments\",\"maxSegmentSec\":\"model\",\"videoModel\":\"ep-h3\"}}],\"questions\":[]}",mock(FileStorageService.class));
        var quoter=mock(StudioPlanQuoter.class);
        doAnswer(i->{ObjectNode plan=i.getArgument(1);((ObjectNode)plan.path("steps").get(0)).put("quotedCost",17);plan.putObject("budget").put("estimated",17).put("autoFixCap",0);return null;})
                .when(quoter).quote(eq("u"),any());
        @SuppressWarnings("unchecked") ObjectProvider<StudioPlanQuoter> quoters=mock(ObjectProvider.class);when(quoters.getIfAvailable()).thenReturn(quoter);
        var executor=mock(StudioPlanExecutor.class);
        @SuppressWarnings("unchecked") ObjectProvider<StudioPlanExecutor> executors=mock(ObjectProvider.class);when(executors.getIfAvailable()).thenReturn(executor);
        ReflectionTestUtils.setField(h.worker(),"planQuoter",quoters);ReflectionTestUtils.setField(h.worker(),"planExecutor",executors);
        h.worker().runBlocking("r");
        assertEquals("done",h.run().getStatus());
        JsonNode plan=json.readTree(h.run().getOutputJson()).path("plan");
        assertEquals(17,plan.path("steps").get(0).path("quotedCost").asLong(),"the model's quote is replaced by the server's");
        assertEquals("reference-video-recreation",plan.path("skillKey").asText());assertEquals("analysis",plan.path("stage").asText());assertEquals(4,plan.path("revision").asInt());
        assertEquals(StudioPlanValidator.fingerprint(plan),plan.path("fingerprint").asText());
        verify(executor).wake("PEX-1");
    }
}
