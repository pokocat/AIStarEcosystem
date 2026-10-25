package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioRecreationTest {
    final ObjectMapper json=new ObjectMapper();
    @TempDir Path directory;
    ObjectNode report() {
        ObjectNode root=json.createObjectNode().put("title","短片").put("creativePremise","大与小形成对抗").put("recreationPrompt","冷色雨夜丛林，体型对比，结尾对峙");
        for(String field:List.of("motifs","retain","uncertainties"))root.putArray(field).add("无音轨，不判断声画同步");
        var visual=root.putArray("visualGenes");
        for(String name:List.of("媒介与美术风格","色彩体系","光线体系","材质与后期","构图体系","摄影机体系"))row(visual.addObject().put("dimension",name));
        var skeleton=root.putArray("skeleton");for(String name:List.of("镜头语言与时空关系","影像与声音","叙事与动作"))row(skeleton.addObject().put("dimension",name));
        var techniques=root.putArray("techniques");for(String name:List.of("体型对比","光线揭示"))row(techniques.addObject().put("name",name).put("effect","可理解为压迫感"));
        return root;
    }
    void row(ObjectNode item){item.put("observed","画面事实").put("rule","可迁移建议").putArray("evidenceFrames").add(1);}
    ObjectNode source(){var source=json.createObjectNode().put("nodeId","video").put("storageKey","owned").put("durationSec",17.067).put("audioAnalyzed",false);source.putArray("frameTimes").add(0).add(0.5);return source;}
    @Test void completeReportWhitelistsAuthorityAndOmitsUnreliableCitationsWithoutDiscardingAnalysis() {
        var root=report();root.putObject("source").put("storageKey","foreign");root.put("unsafe","discard");
        var checked=StudioRecreation.validate(root,source());assertEquals("owned",checked.path("source").path("storageKey").asText());assertFalse(checked.has("unsafe"));
        ((com.fasterxml.jackson.databind.node.ArrayNode)root.path("visualGenes").path(0).path("evidenceFrames")).add(400);
        var partial=StudioRecreation.validate(root,source());assertEquals(List.of(1),json.convertValue(partial.path("visualGenes").path(0).path("evidenceFrames"),List.class));assertTrue(partial.path("uncertainties").toString().contains("已隐藏"));
        var incomplete=report();incomplete.remove("skeleton");assertThrows(BusinessException.class,()->StudioRecreation.validate(incomplete,source()));
        var duplicate=report();((ObjectNode)duplicate.path("visualGenes").path(0)).put("dimension","色彩体系");assertThrows(BusinessException.class,()->StudioRecreation.validate(duplicate,source()));
    }
    @Test void visualChangesKeepBeforeAndAfterAndFillLongGapsWithinBudget() {
        var selection=StudioVideoSampler.choose(137,8,64,List.of(new StudioVideoSampler.Change(41,.5,false),new StudioVideoSampler.Change(72,.8,true)));
        assertTrue(selection.frames().containsAll(List.of(0,40,41,42,71,72,73,136)));
        for(int i=1;i<selection.frames().size();i++)assertTrue(selection.frames().get(i)-selection.frames().get(i-1)<=6);
        var events=new ArrayList<StudioVideoSampler.Change>();
        for(int i=1;i<479;i+=4)events.add(new StudioVideoSampler.Change(i,i/480.0,false));
        var capped=StudioVideoSampler.choose(480,8,64,events);
        assertTrue(capped.frames().size()<=64);assertEquals(0,capped.frames().get(0));assertEquals(479,capped.frames().get(capped.frames().size()-1));
        assertTrue(capped.changes().stream().anyMatch(c->c.frame()==477));
    }
    @Test void lightningIsRecordedAsBrightnessRatherThanAssertedCut() throws Exception {
        for(int i=1;i<=8;i++) {
            var image=new java.awt.image.BufferedImage(64,36,java.awt.image.BufferedImage.TYPE_INT_RGB);
            var g=image.createGraphics();g.setColor(i==4?java.awt.Color.WHITE:java.awt.Color.DARK_GRAY);g.fillRect(0,0,64,36);g.dispose();
            javax.imageio.ImageIO.write(image,"jpg",directory.resolve(String.format("%03d.jpg",i)).toFile());
        }
        Path movie=directory.resolve("flash.mp4");var process=new ProcessBuilder("ffmpeg","-nostdin","-v","error","-framerate","8","-i",directory.resolve("%03d.jpg").toString(),"-c:v","libx264","-pix_fmt","yuv420p","-y",movie.toString()).start();assertTrue(process.waitFor(20,TimeUnit.SECONDS));assertEquals(0,process.exitValue());
        var scan=StudioVideoSampler.scan(movie,directory,1,new StudioHypitMedia("node"));assertEquals(8,scan.times().size());assertEquals(.375,scan.times().get(3));
        var selection=StudioVideoSampler.choose(scan.times(),64,scan.changes());
        assertFalse(selection.changes().isEmpty());assertTrue(selection.changes().stream().allMatch(StudioVideoSampler.Change::lighting));
        assertTrue(selection.frames().containsAll(List.of(2,3,4)));
    }
    @Test void videoRequiresOneExistingOwnedSourceBeforeAnyRead() throws Exception {
        var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);
        var doc=json.readTree("{\"nodes\":[{\"id\":\"v\",\"type\":\"video\",\"metadata\":{\"storageKey\":\"foreign\"}}]}");
        assertThrows(BusinessException.class,()->StudioRecreation.snapshot(doc,List.of(),projects,"u",storage));
        doThrow(BusinessException.badRequest("FOREIGN","unowned")).when(projects).requireOwnedAssetKey("u","foreign");
        assertEquals("FOREIGN",assertThrows(BusinessException.class,()->StudioRecreation.snapshot(doc,List.of("v"),projects,"u",storage)).getCode());verifyNoInteractions(storage);
    }
    @Test void realVideoUsesImmutableSourceAndAdaptiveBoardWithoutAudioOrPersistedUrls() throws Exception {
        Path file=directory.resolve("v.mp4");var p=new ProcessBuilder("ffmpeg","-nostdin","-v","error","-f","lavfi","-i","testsrc2=s=160x120:r=30:d=3","-c:v","libx264","-y",file.toString()).start();assertTrue(p.waitFor(20,TimeUnit.SECONDS));assertEquals(0,p.exitValue());
        var projects=mock(IpProjectService.class);var storage=mock(FileStorageService.class);when(storage.openForRead("owned")).thenReturn(file);
        var doc=json.readTree("{\"nodes\":[{\"id\":\"v\",\"type\":\"video\",\"title\":\"片\",\"metadata\":{\"storageKey\":\"owned\"}}]}");
        var snapshot=StudioRecreation.snapshot(doc,List.of("v"),projects,"u",storage);assertEquals(0,snapshot.path("frameTimes").size());assertFalse(snapshot.path("audioAnalyzed").asBoolean());
        var study=StudioRecreation.study(snapshot,storage);var parts=study.pages().get(0);assertEquals((snapshot.path("frameTimes").size()+7)/8,study.pages().size());assertEquals(1,parts.stream().filter(x->"image_url".equals(x.get("type"))).count());assertTrue(parts.get(0).get("text").toString().contains("不含音轨"));assertEquals("hypit-media-v1",snapshot.path("samplingStrategy").asText());assertTrue(snapshot.path("frameTimes").size()>=5);assertFalse(snapshot.toString().contains("base64"));
        assertEquals("image_url",study.ending().get("type"));assertEquals(4,study.previews().size());assertTrue(study.previews().stream().allMatch(pv->pv.bytes().length>0&&pv.frame()<=snapshot.path("frameTimes").size()));
        var markdown=StudioRecreation.markdown(StudioRecreation.validate(report(),snapshot));assertTrue(markdown.contains("| 维度 | 全片特征 |"));assertTrue(markdown.contains("| 维度 | 片中构造 | 可复用规律 |"));assertTrue(markdown.contains("| 创作手法 | 片中作用 |"));
    }
    @Test void missingHypitRuntimeIsAConfigurationError() {
        var failure=assertThrows(BusinessException.class,()->new StudioHypitMedia("/missing-studio-node").requireReady());
        assertEquals("STUDIO_HYPIT_UNAVAILABLE",failure.getCode());
    }
    @Test void passageEvidenceMustStayInsideTheActualPage() throws Exception {
        String content="{\"observations\":[{\"evidenceFrames\":[9],\"visible\":\"小恐龙站在大型恐龙对面\"}],\"look\":\"冷色雨夜\",\"uncertainties\":\"身份不明\"}";
        assertNotNull(StudioRecreation.observation(content,9,16));
        var partial=StudioRecreation.observation(content,1,8);assertTrue(partial.path("observations").path(0).path("evidenceFrames").isEmpty());assertTrue(partial.path("uncertainties").asText().contains("无法确认"));
    }
    @Test void multiStageRecreationAggregatesUsageAndChargesOnlyOnce() throws Exception {
        Path file=directory.resolve("static.mp4");var process=new ProcessBuilder("ffmpeg","-nostdin","-v","error","-f","lavfi","-i","color=c=gray:s=160x120:r=30:d=3","-c:v","libx264","-y",file.toString()).start();assertTrue(process.waitFor(20,TimeUnit.SECONDS));assertEquals(0,process.exitValue());
        var runs=mock(com.aistareco.aep.ipstudio.repository.IpRunRepository.class);var models=mock(com.aistareco.aep.service.AiModelInvocationService.class);var credits=mock(com.aistareco.aep.service.CreditService.class);var tx=mock(org.springframework.transaction.PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new org.springframework.transaction.support.SimpleTransactionStatus());
        var storage=mock(FileStorageService.class);when(storage.openForRead("owned")).thenReturn(file);when(storage.store(any(byte[].class),anyString(),nullable(String.class),eq("jpg"),eq("image/jpeg"))).thenReturn(new FileStorageService.StoredFile("preview.jpg","", "", "", 10L,"image/jpeg"));
        var input=json.createObjectNode().put("operation","recreation");var execution=input.putObject("_exec").put("systemPrompt","report").put("userPrompt","分析").put("endpointId","vision").put("maxTokens",8192);var source=source();source.put("durationSec",3);execution.set("recreationSource",source);
        execution.set("tokenPricing",json.valueToTree(new com.aistareco.aep.service.AiChatTokenPricing.Rate(new java.math.BigDecimal(".18"),new java.math.BigDecimal("1.08"),65536,8192)));
        var run=com.aistareco.aep.ipstudio.model.IpRun.builder().id("r").kind("studio-recreation").status("running").cost(21).inputJson(input.toString()).build();when(runs.findById("r")).thenReturn(Optional.of(run));when(runs.lockById("r")).thenReturn(Optional.of(run));
        var endpoint=com.aistareco.aep.model.AiModelEndpoint.builder().id("vision").model("v").modelsJson("[{\"id\":\"v\",\"supportsVision\":true}]").enabled(true).build();
        when(models.resolveEndpoint(com.aistareco.aep.model.AiModelPurpose.DAP_PERSONA,"vision","studio")).thenReturn(Optional.of(new com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));when(models.resolveAcceptedEndpoint(com.aistareco.aep.model.AiModelPurpose.DAP_PERSONA,"vision","studio")).thenReturn(Optional.of(new com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        var observation="{\"observations\":[{\"evidenceFrames\":[1],\"visible\":\"灰色画面\"}],\"look\":\"灰色\",\"uncertainties\":\"无\"}";
        when(models.invokeChatOnEndpoint(eq(endpoint),any(),anyList(),anyMap())).thenReturn(new com.aistareco.aep.service.AiModelInvocationService.AiModelResponse(observation,"stop",2000L,"v","v",1000L,1000L),new com.aistareco.aep.service.AiModelInvocationService.AiModelResponse(report().toString(),"stop",2000L,"v","v",1000L,1000L));
        var worker=new StudioWorkflowWorker(runs,mock(StudioFixtureProvider.class),storage,models,mock(com.aistareco.aep.service.DramaAssembleService.class),credits,json,tx,mock(com.aistareco.aep.dap.service.DapAssetService.class));org.springframework.test.util.ReflectionTestUtils.setField(worker,"hypitMedia",new StudioHypitMedia("node"));worker.runBlocking("r");worker.runBlocking("r");
        assertEquals("done",run.getStatus());assertEquals(3,run.getCost());var messages=org.mockito.ArgumentCaptor.forClass(List.class);verify(models,times(2)).invokeChatOnEndpoint(eq(endpoint),any(),messages.capture(),anyMap());assertTrue(messages.getAllValues().get(1).toString().contains("未拼格的原片最后一帧"));verify(credits,times(1)).commitHold(anyString(),eq("r"),eq(3L),anyString(), org.mockito.ArgumentMatchers.any());
        assertEquals(4,json.readTree(run.getOutputJson()).path("recreation").path("references").size());
        assertEquals(2000,json.readTree(run.getOutputJson()).path("billing").path("inputTokens").asInt());assertEquals("hypit-media-v1",json.readTree(run.getInputJson()).path("_exec").path("recreationSource").path("samplingStrategy").asText());
    }

}
