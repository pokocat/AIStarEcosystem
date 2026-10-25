package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
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
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.test.util.ReflectionTestUtils;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Native check and the film-study segment cap: both are refused before any hold when their inputs are not real. */
class StudioWorkflowSkillRequestTest {
    final ObjectMapper json=new ObjectMapper();
    @TempDir Path directory;
    IpProjectService projects;IpRunRepository runs;CreditService credits;StudioWorkflowService service;StudioVideoService videos;Path clip;FileStorageService storage;
    final Map<String,IpRun> owned=new HashMap<>();final Map<String,IpRunDto> dtos=new HashMap<>();

    @org.junit.jupiter.api.AfterEach void clear() {org.springframework.transaction.support.TransactionSynchronizationManager.clearSynchronization();}
    @BeforeEach void setUp() throws Exception {
        org.springframework.transaction.support.TransactionSynchronizationManager.initSynchronization();
        clip=directory.resolve("clip.mp4");
        var ffmpeg=new ProcessBuilder("ffmpeg","-v","error","-y","-f","lavfi","-i","testsrc2=s=320x180:r=30:d=8","-c:v","libx264","-threads","2",clip.toString()).start();
        assertTrue(ffmpeg.waitFor(30,TimeUnit.SECONDS));assertEquals(0,ffmpeg.exitValue());
        projects=mock(IpProjectService.class);runs=mock(IpRunRepository.class);credits=mock(CreditService.class);
        var project=IpProject.builder().id("p").build();
        when(projects.requiredForUpdate("u","p")).thenReturn(project);
        when(projects.readDoc(project)).thenReturn(json.readTree("{\"nodes\":[{\"id\":\"src\",\"type\":\"video\",\"title\":\"原片\",\"metadata\":{\"storageKey\":\"src.mp4\"}},"
                +"{\"id\":\"report\",\"type\":\"text\",\"metadata\":{\"studio\":{\"kind\":\"recreation\"}}}]}"));
        when(projects.requireOwnedAssetKey(eq("u"),anyString())).thenAnswer(i->i.getArgument(1));
        when(projects.ownedRun(eq("u"),eq("p"),anyString())).thenAnswer(i->Optional.ofNullable(owned.get((String)i.getArgument(2))));
        when(projects.toRunDto(any())).thenAnswer(i->dtos.get(((IpRun)i.getArgument(0)).getId()));
        when(projects.parseOrEmptyObject(any())).thenAnswer(i->i.getArgument(0)==null?json.createObjectNode():json.readTree((String)i.getArgument(0)));
        when(runs.findByProjectIdAndClientRequestId(anyString(),anyString())).thenReturn(Optional.empty());
        var models=mock(AiModelInvocationService.class);var pricing=mock(DapPricingService.class);var prompts=mock(PromptService.class);
        when(pricing.ipIdentity()).thenReturn(2L);
        var endpoint=AiModelEndpoint.builder().id("vision").enabled(true).model("m").modelsJson("[{\"id\":\"m\",\"supportsVision\":true}]").build();
        when(models.resolveEndpoint(AiModelPurpose.DAP_PERSONA,null,"studio")).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint,null,true)));
        when(prompts.resolve(anyString())).thenAnswer(i->new PromptService.ResolvedPrompt("system:"+i.getArgument(0),"清单={{checklist}}|目标={{target}}|画面={{frames}}",new PromptParamsDto(null,null,null),"resource"));
        service=new StudioWorkflowService(projects,runs,mock(StudioFixtureProvider.class),mock(StudioWorkflowWorker.class),pricing,models,null,credits,null,null,null,null,json,null,prompts);
        var tokenPricing=mock(AiChatTokenPricing.class);
        when(tokenPricing.find("vision")).thenReturn(new AiChatTokenPricing.Rate(new java.math.BigDecimal("0.18"),new java.math.BigDecimal("1.08"),65536,8192));
        ReflectionTestUtils.setField(service,"tokenPricing",tokenPricing);
        storage=mock(FileStorageService.class);when(storage.openForRead(anyString())).thenReturn(clip);
        ReflectionTestUtils.setField(service,"recreationStorage",storage);
        ReflectionTestUtils.setField(service,"hypitMedia",mock(StudioHypitMedia.class));
        ReflectionTestUtils.setField(service,"planOutputs",new StudioPlanOutputs(runs,projects,json));
        String file;try(var in=getClass().getResourceAsStream("/studio/skills/reference-video-recreation.md")){file=new String(in.readAllBytes(),StandardCharsets.UTF_8);}
        var catalog=mock(StudioSkillCatalog.class);when(catalog.requireForNewWork("reference-video-recreation")).thenReturn(StudioSkillCatalog.parse(file));
        when(catalog.requireForNewWork("gone")).thenThrow(StudioSkillCatalog.notFound());
        @SuppressWarnings("unchecked") ObjectProvider<StudioSkillCatalog> catalogs=mock(ObjectProvider.class);when(catalogs.getIfAvailable()).thenReturn(catalog);
        ReflectionTestUtils.setField(service,"skillRules",new StudioSkillRules(catalogs));
        videos=mock(StudioVideoService.class);
        var contract=new VideoStudioContract(List.of(),List.of(),4,15,2000,2147483647L);
        when(videos.models()).thenReturn(List.of(new VideoStudioModel("ep-h3","H3",true,true,contract,null)));
        ReflectionTestUtils.setField(service,"studioVideo",videos);
        owned.put("IPR-video",IpRun.builder().id("IPR-video").ownerUserId("u").projectId("p").kind("studio-video").build());
        var output=json.createObjectNode();output.putArray("videoCandidates").addObject().put("index",0).put("status","done").put("storageKey","made.mp4");output.put("storageKey","made.mp4");
        dtos.put("IPR-video",new IpRunDto("IPR-video","p","n","studio-video","done","done",100,40,null,null,json.createObjectNode(),output,Instant.now().toString(),null,null));
    }

    @Test void capabilitiesExposeCheckAndTheTextModelsToolAndStreamingFlags() {
        var models=(AiModelInvocationService)ReflectionTestUtils.getField(service,"models");
        var tools=AiModelEndpoint.builder().id("tools").enabled(true).model("m").chatSupportsTools(true).chatSupportsStreaming(true).build();
        var plain=AiModelEndpoint.builder().id("plain").enabled(true).model("m").build();
        var candidate=com.aistareco.aep.model.AiAppEndpointCandidate.builder().build();
        when(models.listCandidates(AiModelPurpose.DAP_PERSONA,"studio")).thenReturn(List.of(
                new AiModelInvocationService.ResolvedEndpoint(tools,candidate,true),new AiModelInvocationService.ResolvedEndpoint(plain,candidate,false)));
        var capabilities=service.capabilities();
        assertTrue(capabilities.operations().contains("check"));
        assertTrue(capabilities.textModels().get(0).supportsTools());assertTrue(capabilities.textModels().get(0).supportsStreaming());
        assertFalse(capabilities.textModels().get(1).supportsTools(),"null means not supported");assertFalse(capabilities.textModels().get(1).supportsStreaming());
    }

    RunRequest check(String target,String key,String... ids) throws Exception {
        ObjectNode body=json.createObjectNode().put("clientRequestId","chk").put("nodeId","n-check").put("operation","check").put("prompt","第一段要换成蓝色保温杯")
                .put("maxCost",21).put("skillKey","reference-video-recreation");
        var check=body.putObject("check").put("targetRunId",target);if(key!=null)check.put("targetStorageKey",key);
        var array=check.putArray("checkIds");for(String id:ids)array.add(id);
        return json.treeToValue(body,RunRequest.class);
    }

    @Test void checkTargetsOnlyARealSuccessfulOutputAndSamplesFramesServerSide() throws Exception {
        assertEquals("STUDIO_CHECK_TARGET_INVALID",assertThrows(BusinessException.class,()->service.submit("u","p",check("IPR-missing",null,"subject-replaced"))).getCode());
        assertEquals("STUDIO_CHECK_TARGET_INVALID",assertThrows(BusinessException.class,()->service.submit("u","p",check("IPR-video","someone-else.mp4","subject-replaced"))).getCode());
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->service.submit("u","p",check("IPR-video",null,"made-up"))).getCode());
        var withdrawn=(ObjectNode)json.valueToTree(check("IPR-video",null,"subject-replaced"));withdrawn.put("skillKey","gone");
        assertEquals("STUDIO_SKILL_NOT_FOUND",assertThrows(BusinessException.class,()->service.submit("u","p",json.treeToValue(withdrawn,RunRequest.class))).getCode());
        var visuals=(ObjectNode)json.valueToTree(check("IPR-video",null,"subject-replaced"));visuals.put("readVisuals",true);
        assertThrows(BusinessException.class,()->service.submit("u","p",json.treeToValue(visuals,RunRequest.class)),"the client never supplies the visual context");
        verifyNoInteractions(credits);
        service.submit("u","p",check("IPR-video",null,"subject-replaced","dialogue-and-subtitles"));
        var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());
        IpRun run=capture.getValue();JsonNode exec=json.readTree(run.getInputJson()).path("_exec");
        assertEquals("studio-check",run.getKind());assertEquals(21,run.getCost());
        assertEquals("made.mp4",exec.path("check").path("targetStorageKey").asText(),"defaults to the run's primary output");
        assertEquals("[1.0,3.0,5.0,7.0]",exec.path("check").path("sampledTimesSec").toString());
        assertEquals(8.0,exec.path("check").path("mediaFacts").path("durationSec").asDouble(),0.05);
        assertEquals("system:"+PromptService.KEY_DAP_IP_STUDIO_SKILL_CHECK,exec.path("systemPrompt").asText());
        assertTrue(exec.path("userPrompt").asText().contains("subject-replaced")&&exec.path("userPrompt").asText().contains("[1.0,3.0,5.0,7.0]"));
        assertEquals("reference-video-recreation",exec.path("skill").path("key").asText());
        verify(credits).hold(eq("u"),eq(21L),anyString(),eq(run.getId()),anyString(), org.mockito.ArgumentMatchers.any(com.aistareco.aep.billing.service.ModelChargeContext.class));
    }

    RunRequest recreation(String maxSegmentSec,String model) throws Exception {
        ObjectNode body=json.createObjectNode().put("clientRequestId","rec").put("nodeId","report").put("operation","recreation").put("prompt","看结构")
                .put("mode","segments").put("maxCost",21);
        body.putArray("contextNodeIds").add("src");
        if(maxSegmentSec!=null)body.putObject("recreation").put("maxSegmentSec",maxSegmentSec).put("videoModel",model);
        return json.treeToValue(body,RunRequest.class);
    }

    @Test void segmentCapReadsTheModelContractAndRefusesImpossibleSourcesBeforeAnyHold() throws Exception {
        Path longClip=directory.resolve("long.mp4");
        var ffmpeg=new ProcessBuilder("ffmpeg","-v","error","-y","-f","lavfi","-i","testsrc2=s=160x90:r=10:d=20","-c:v","libx264","-threads","2",longClip.toString()).start();
        assertTrue(ffmpeg.waitFor(30,TimeUnit.SECONDS));assertEquals(0,ffmpeg.exitValue());
        when(storage.openForRead(anyString())).thenReturn(longClip);
        assertEquals("STUDIO_VIDEO_MODEL_UNAVAILABLE",assertThrows(BusinessException.class,()->service.submit("u","p",recreation("model","unknown"))).getCode());
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->service.submit("u","p",recreation("20","ep-h3"))).getCode(),"explicit cap above the model maximum");
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->service.submit("u","p",recreation("0.5","ep-h3"))).getCode());
        var impossible=assertThrows(BusinessException.class,()->service.submit("u","p",recreation("2","ep-h3")));
        assertEquals("STUDIO_SEGMENT_TOO_LONG",impossible.getCode(),"20 s cannot fit into 8 × 2 s");
        assertEquals(2.0,((JsonNode)impossible.getDetails()).path("maxSegmentSec").asDouble());
        verifyNoInteractions(credits);
        service.submit("u","p",recreation("model","ep-h3"));
        var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());
        JsonNode exec=json.readTree(capture.getValue().getInputJson()).path("_exec");
        assertEquals(15.0,exec.path("segmentCap").path("maxSegmentSec").asDouble(),"H3 contract maximum");
        assertEquals("model",exec.path("segmentCap").path("requested").asText());assertEquals(15,exec.path("segmentCap").path("contract").path("maxSeconds").asInt());
        verify(credits).hold(eq("u"),eq(21L),anyString(),anyString(),anyString(), org.mockito.ArgumentMatchers.any(com.aistareco.aep.billing.service.ModelChargeContext.class));
    }

    @Test void callersWithoutACapKeepTheirExactRequestIdentity() throws Exception {
        when(storage.openForRead(anyString())).thenReturn(clip);
        service.submit("u","p",recreation(null,null));
        var capture=ArgumentCaptor.forClass(IpRun.class);verify(runs).save(capture.capture());
        JsonNode input=json.readTree(capture.getValue().getInputJson());
        assertFalse(input.path("_exec").has("segmentCap"));
        var legacy=new RunRequest("rec","report","recreation","看结构",null,null,null,null,null,null,null,null,"segments",List.of("src"),null,21L,null,null,null,null,null,null);
        // The accepted fingerprint of a pre-upgrade request is unchanged by the new nullable fields.
        when(runs.findByProjectIdAndClientRequestId("p","rec")).thenReturn(Optional.of(capture.getValue()));
        when(projects.toRunDto(capture.getValue())).thenReturn(null);
        assertDoesNotThrow(()->service.submit("u","p",legacy));
    }
}
