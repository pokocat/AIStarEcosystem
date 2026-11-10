package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 拉片 v2 在 worker 里的整条路（模型调用是假的，ffmpeg 是真的）：交给模型的是视频，结果落 breakdown 和裁好的段，按用量结算一次。 */
class StudioVideoBreakdownWorkerTest {
    final ObjectMapper json=new ObjectMapper();
    @TempDir Path directory;

    @Test
    void theWholeVideoGoesToTheModelAndTheRunEndsWithShotsAndCutUnits() throws Exception {
        // 6 秒、3 秒处换画面的测试视频
        Path file=directory.resolve("two-scenes.mp4");
        var process=new ProcessBuilder("ffmpeg","-nostdin","-v","error","-f","lavfi","-i","color=c=red:s=320x568:r=30:d=3","-f","lavfi","-i","color=c=blue:s=320x568:r=30:d=3",
                "-filter_complex","[0:v][1:v]concat=n=2:v=1[v]","-map","[v]","-c:v","libx264","-pix_fmt","yuv420p","-y",file.toString()).start();
        assertTrue(process.waitFor(30,TimeUnit.SECONDS));assertEquals(0,process.exitValue());
        var runs=mock(com.aistareco.aep.ipstudio.repository.IpRunRepository.class);var models=mock(AiModelInvocationService.class);var credits=mock(com.aistareco.aep.service.CreditService.class);
        var tx=mock(org.springframework.transaction.PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new org.springframework.transaction.support.SimpleTransactionStatus());
        var storage=mock(FileStorageService.class);when(storage.openForRead("owned")).thenReturn(file);
        when(storage.store(any(byte[].class),anyString(),nullable(String.class),anyString(),anyString())).thenAnswer(inv->new FileStorageService.StoredFile("stored-"+inv.getArgument(3),"","","",10L,inv.getArgument(4)));
        var input=json.createObjectNode().put("operation","recreation").put("mode","segments").put("prompt","人物换成图1");
        ObjectNode exec=input.putObject("_exec").put("endpointId","lite").put("maxTokens",16000).put("videoUnderstand",true);
        exec.putObject("recreationSource").put("nodeId","v").put("title","参考视频").put("storageKey","owned").put("durationSec",6.0).put("audioAnalyzed",false).putArray("frameTimes");
        exec.putObject("segmentCap").put("maxSegmentSec",15.0).put("maxSegments",8).putObject("contract").put("minSeconds",4).put("maxSeconds",15);
        exec.set("tokenPricing",json.valueToTree(new com.aistareco.aep.service.AiChatTokenPricing.Rate(new java.math.BigDecimal(".18"),new java.math.BigDecimal("1.08"),65536,16000)));
        var run=com.aistareco.aep.ipstudio.model.IpRun.builder().id("r").kind("studio-recreation").status("running").cost(21).inputJson(input.toString()).build();
        when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));
        var endpoint=com.aistareco.aep.model.AiModelEndpoint.builder().id("lite").model("seed-lite").modelsJson("[{\"id\":\"seed-lite\",\"supportsVideo\":true}]").enabled(true).build();
        when(models.resolveAcceptedEndpoint(AiModelPurpose.DAP_VIDEO_UNDERSTAND,"lite","studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        String answer="{\"summary\":\"红到蓝\",\"shots\":[{\"start\":0,\"end\":3,\"visual\":\"红\",\"dialogue\":[{\"who\":\"P1\",\"text\":\"你好\"}]},{\"start\":3,\"end\":6,\"visual\":\"蓝\"}],"
                +"\"parts\":[{\"name\":\"钩子\",\"start\":0,\"end\":6}],\"remake\":{\"keep\":[\"节奏\"]}}";
        // 第二遍逐镜细读：两个镜头都在一个 6 秒窗口里，一次调用；frameAt 写成了小段里的秒数（2026-11-10 真跑见过）
        String detail="{\"shots\":[{\"no\":1,\"layout\":\"女生在远处，只有手指大小\",\"trick\":\"手指捏住远处的人\",\"frameAt\":0.2},"
                +"{\"no\":2,\"scene\":\"蓝色房间\",\"frameAt\":3.4}]}";
        when(models.invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_VIDEO_UNDERSTAND),anyList(),anyMap()))
                .thenReturn(new AiModelInvocationService.AiModelResponse(answer,"stop",3000L,"seed-lite","seed-lite",2500L,500L))
                .thenReturn(new AiModelInvocationService.AiModelResponse(detail,"stop",1200L,"seed-lite","seed-lite",1000L,200L));
        var worker=new StudioWorkflowWorker(runs,mock(StudioFixtureProvider.class),storage,models,mock(com.aistareco.aep.service.DramaAssembleService.class),credits,json,tx,mock(com.aistareco.aep.dap.service.DapAssetService.class));
        org.springframework.test.util.ReflectionTestUtils.setField(worker,"hypitMedia",new StudioHypitMedia("node"));
        worker.runBlocking("r");

        assertEquals("done",run.getStatus());
        var messages=org.mockito.ArgumentCaptor.forClass(List.class);
        verify(models,times(2)).invokeChatOnEndpoint(eq(endpoint),eq(AiModelPurpose.DAP_VIDEO_UNDERSTAND),messages.capture(),anyMap());
        var user=(Map<?,?>)messages.getAllValues().get(0).get(1);
        var detailUser=(Map<?,?>)messages.getAllValues().get(1).get(1);
        var detailVideo=(Map<?,?>)((Map<?,?>)((List<?>)detailUser.get("content")).get(0)).get("video_url");
        assertEquals(StudioVideoBreakdown.DETAIL_FPS,detailVideo.get("fps"),"第二遍每秒 5 帧细看");
        assertEquals("video_url",((Map<?,?>)((List<?>)user.get("content")).get(0)).get("type"),"交给模型的是视频本身，不是截图");
        String userText=String.valueOf(((Map<?,?>)((List<?>)user.get("content")).get(1)).get("text"));
        assertTrue(userText.contains("3"),"真实切镜点交给了模型："+userText);
        var output=json.readTree(run.getOutputJson());
        var film=output.path("filmStudy");
        assertEquals(StudioVideoBreakdown.STRATEGY,film.path("strategy").asText());
        assertEquals(2,film.path("breakdown").path("shots").size());
        assertTrue(film.path("source").path("audioAnalyzed").asBoolean());
        assertEquals(1,film.path("segments").size(),"6 秒一段");
        assertEquals("stored-mp4",film.path("segments").get(0).path("storageKey").asText());
        assertTrue(output.path("text").asText().contains("P1：你好"));
        var shots=film.path("breakdown").path("shots");
        assertEquals("女生在远处，只有手指大小",shots.get(0).path("detail").path("layout").asText());
        assertEquals("手指捏住远处的人",shots.get(0).path("detail").path("trick").asText());
        assertEquals(3.4,shots.get(1).path("detail").path("frameAt").asDouble(),"原片秒数照用");
        assertTrue(film.path("breakdown").path("detailDone").asBoolean());
        assertEquals(2,film.path("frames").size(),"每个镜头截一张开场画面");
        assertEquals("stored-jpg",film.path("frames").get(0).path("storageKey").asText());
        assertTrue(output.path("text").asText().contains("逐镜细读"));
        assertEquals(3500,output.path("billing").path("inputTokens").asInt(),"两次调用的用量一起结算");
        verify(credits,times(1)).commitHold(anyString(),eq("r"),anyLong(),anyString(),any());
    }
}
