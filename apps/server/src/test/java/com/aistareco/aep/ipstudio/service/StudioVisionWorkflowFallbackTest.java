package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.model.*;
import com.aistareco.aep.service.*;
import com.aistareco.aep.service.ai.AiChatHttpException;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.math.BigDecimal;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioVisionWorkflowFallbackTest {
    @TempDir Path directory;
    final ObjectMapper json=new ObjectMapper();

    @Test void filmFallbackCountsEverySuccessfulCallAndSettlesOnlyOnce() throws Exception {verifyFlow(true,null);}
    @Test void fullFilmPageUsesTheSameConditionalFallbackAndCombinedBilling() throws Exception {verifyFlow(false,null);}
    @Test void unrelatedFailureReleasesHoldAndNeverMakesFallbackCalls() throws Exception {
        verifyFlow(true,BusinessException.badRequest("AI_PROVIDER_TIMEOUT","timeout"));
    }

    void verifyFlow(boolean segments,BusinessException unrelated) throws Exception {
        Path video=directory.resolve("source.mp4");var process=new ProcessBuilder("ffmpeg","-v","error","-y","-f","lavfi","-i","testsrc2=s=320x180:r=24:d=2","-c:v","libx264","-threads","2",video.toString()).start();
        assertTrue(process.waitFor(30,TimeUnit.SECONDS));assertEquals(0,process.exitValue());
        var runs=mock(IpRunRepository.class);var models=mock(AiModelInvocationService.class);var credits=mock(CreditService.class);
        var tx=mock(PlatformTransactionManager.class);when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        var storage=mock(FileStorageService.class);when(storage.openForRead("owned")).thenReturn(video);var stored=new AtomicInteger();
        when(storage.store(any(byte[].class),anyString(),nullable(String.class),anyString(),anyString())).thenAnswer(call->
                new FileStorageService.StoredFile("asset-"+stored.incrementAndGet()+"."+call.getArgument(3),"","","",((byte[])call.getArgument(0)).length,call.getArgument(4)));
        var input=json.createObjectNode().put("operation","recreation");if(segments)input.put("mode","segments");
        var exec=input.putObject("_exec").put("systemPrompt","report").put("userPrompt","analyze").put("endpointId","vision").put("maxTokens",8192);
        exec.putObject("recreationSource").put("storageKey","owned").put("durationSec",2).putArray("frameTimes");
        var rate=new AiChatTokenPricing.Rate(new BigDecimal(".18"),new BigDecimal("1.08"),65536,8192);exec.set("tokenPricing",json.valueToTree(rate));
        var run=IpRun.builder().id("r").ownerUserId("owner").projectId("p").nodeId("v").kind("studio-recreation").status("running").cost(21).inputJson(input.toString()).build();
        when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));
        var endpoint=AiModelEndpoint.builder().id("vision").model("v").modelsJson("[{\"id\":\"v\",\"supportsVision\":true}]").enabled(true).build();
        var candidate=AiAppEndpointCandidate.builder().maxRefImages(9).build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,"vision","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,candidate,true)));
        var calls=new AtomicInteger();var successes=new AtomicInteger();
        when(models.invokeChatOnEndpoint(eq(endpoint),any(),anyList(),anyMap())).thenAnswer(call->{
            int n=calls.getAndIncrement();if(n==0){if(unrelated!=null)throw unrelated;throw StudioVisionFallbackTest.memory();}
            List<Map<String,Object>> messages=call.getArgument(2);String system=messages.get(0).get("content").toString();
            @SuppressWarnings("unchecked") var parts=(List<Map<String,Object>>)messages.get(1).get("content");
            int images=(int)parts.stream().filter(p->"image_url".equals(p.get("type"))).count();String content;
            if(system.startsWith("按输入图片")) {
                assertTrue(images>0&&images<=2);content="{\"frames\":["+String.join(",",Collections.nCopies(images,"{\"visible\":\"原片事实\",\"uncertainty\":\"无\"}"))+"]}";
            } else if(system.startsWith("将原片")) {assertEquals(0,images);content="{\"segments\":[{\"endSec\":2}]}";}
            else if(system.startsWith("你是视频创作")) {assertTrue(images>0,"subsequent successful segment still uses original images");content="## 本段正文";}
            else if(system.equals("report")) {content=new StudioRecreationTest().report().toString();}
            else {assertEquals(0,images);content="{\"observations\":[{\"evidenceFrames\":[1],\"visible\":\"原片事实\"}],\"look\":\"色彩\",\"uncertainties\":\"无\"}";}
            successes.incrementAndGet();return new AiModelInvocationService.AiModelResponse(content,"stop",150L,"vision","v",100L,50L);
        });
        var worker=new StudioWorkflowWorker(runs,mock(StudioFixtureProvider.class),storage,models,mock(DramaAssembleService.class),credits,json,tx,mock(com.aistareco.aep.dap.service.DapAssetService.class));
        org.springframework.test.util.ReflectionTestUtils.setField(worker,"hypitMedia",new StudioHypitMedia("node"));worker.runBlocking("r");worker.runBlocking("r");
        if(unrelated!=null){assertEquals("failed",run.getStatus());assertEquals(0,run.getCost());assertEquals(1,calls.get());verify(credits,never()).commitHold(anyString(),anyString(),anyLong(),anyString());}
        else {
            assertEquals("done",run.getStatus(),run.getErrorMessage());var output=json.readTree(run.getOutputJson());
            assertEquals(successes.get()*100L,output.path("billing").path("inputTokens").asLong());assertEquals(successes.get()*50L,output.path("billing").path("outputTokens").asLong());
            long cost=rate.settle(successes.get()*100L,successes.get()*50L);assertEquals(cost,run.getCost());
            verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(cost),anyString());
        }
        verify(credits,times(1)).releaseHold(anyString(),eq("r"),anyString());
    }
}
