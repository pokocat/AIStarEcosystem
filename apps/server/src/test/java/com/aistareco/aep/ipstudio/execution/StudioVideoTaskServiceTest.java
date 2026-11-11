package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.PlanExecution;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.segmented.SegmentedVideoService;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.*;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StudioVideoTaskServiceTest {
    final ObjectMapper om=new ObjectMapper();
    final IpPlanExecutionRepository repository=mock(IpPlanExecutionRepository.class);
    final StudioPlanExecutionService executions=mock(StudioPlanExecutionService.class);
    final IpProjectService projects=mock(IpProjectService.class);
    final StudioWorkflowService workflow=mock(StudioWorkflowService.class);
    final IpRunRepository nativeRuns=mock(IpRunRepository.class);
    final StudioSkillRules skills=mock(StudioSkillRules.class);
    final Map<String,IpPlanExecution> rows=new HashMap<>();
    StudioVideoTaskService service;
    @BeforeEach void setup() {
        var project=IpProject.builder().id("p").ownerUserId("u").name("测试视频").sceneId("ecom-talking").build();
        when(projects.required("u","p")).thenReturn(project);
        when(repository.findById(anyString())).thenAnswer(i->Optional.ofNullable(rows.get(i.getArgument(0))));
        when(repository.findByOwnerUserIdAndClientRequestId(anyString(),anyString())).thenAnswer(i->rows.values().stream().filter(r->i.getArgument(0).equals(r.getOwnerUserId())&&i.getArgument(1).equals(r.getClientRequestId())).findFirst());
        when(workflow.quote(eq("u"),any())).thenReturn(10L);
        var rule=new StudioSkillRules.Rules("video-generation","视频",1,"active",Map.of("production",List.of("video")),60,12,"model",40,0,List.of(),List.of(),List.of(),"方法","digest");
        when(skills.requireActive("video-generation")).thenReturn(rule);
        when(executions.toDto(any())).thenAnswer(i->{var row=(IpPlanExecution)i.getArgument(0);return om.convertValue(om.createObjectNode().put("id",row.getId()).put("projectId","p").put("status",row.getStatus()),PlanExecution.class);});
        when(executions.startVideoTask(anyString(),anyString(),anyString(),any(),isNull(),any(),anyList(),any(),anyLong(),anyLong(),any(),any())).thenAnswer(i->{
            String id="PEX-one";ObjectNode state=om.createObjectNode();state.set("videoTask",i.getArgument(5));state.putArray("steps");
            var row=IpPlanExecution.builder().id(id).projectId("p").ownerUserId("u").clientRequestId(i.getArgument(2)).status("running").stepsJson(state.toString()).createdAt(Instant.now()).build();rows.put(id,row);
            return executions.toDto(row);
        });
        service=new StudioVideoTaskService(repository,nativeRuns,executions,mock(SegmentedVideoService.class),workflow,mock(StudioPlanQuoter.class),skills,projects,mock(StudioVideoService.class),om);
    }
    StudioVideoTaskService.Create request(long cap,String prompt) {
        RunRequest video=om.convertValue(om.createObjectNode().put("operation","video").put("prompt",prompt).put("nodeId","n").put("durationSec",12).put("maxCost",10L),RunRequest.class);
        return new StudioVideoTaskService.Create("request-one","direct","ecom-talking","测试视频",null,video,cap,null,om.createObjectNode().put("saved","input"),null);
    }
    @Test void acceptedTaskOwnsTheInputAndReturnsTheOriginalOnReplayBeforeRepricing() {
        var first=service.start("u","p",request(30,"原稿"));
        assertEquals("PEX-one",first.id());assertEquals("input",first.input().path("saved").asText());
        when(workflow.quote(eq("u"),any())).thenThrow(new IllegalStateException("model config changed"));
        assertEquals(first.id(),service.start("u","p",request(30,"原稿")).id());
        verify(workflow,times(1)).quote(eq("u"),any());verify(workflow,never()).submit(anyString(),anyString(),any());
    }
    // 2026-11-11：动作提取一次只做一段，受理时就限住，排太久的段会被当成卡死判超时
    @Test void depthAdmissionAllowsOnePerPersonAndCapsTheSite() {
        java.util.function.Function<String,IpPlanExecution> depth=owner->IpPlanExecution.builder().id("PEX-"+owner).ownerUserId(owner).status("running")
                .stepsJson(om.createObjectNode().set("videoTask",om.createObjectNode().put("kind","depth")).toString()).build();
        when(repository.findByStatusIn(anyCollection())).thenReturn(List.of(depth.apply("u")));
        assertEquals("STUDIO_DEPTH_USER_BUSY",assertThrows(BusinessException.class,()->service.admitDepth("u")).getCode());
        service.admitDepth("other");
        when(repository.findByStatusIn(anyCollection())).thenReturn(List.of(depth.apply("a"),depth.apply("b"),depth.apply("c")));
        assertEquals("STUDIO_DEPTH_SITE_BUSY",assertThrows(BusinessException.class,()->service.admitDepth("d")).getCode());
        when(repository.findByStatusIn(anyCollection())).thenReturn(List.of());
        when(nativeRuns.countByKindAndStatus("studio-video-control","running")).thenReturn(12L);
        assertEquals("STUDIO_DEPTH_SITE_BUSY",assertThrows(BusinessException.class,()->service.admitDepth("d")).getCode());
    }
    @Test void anIdentityCannotBeReusedWithChangedInput() {
        service.start("u","p",request(30,"原稿"));
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.start("u","p",request(30,"另一版"))).getCode());
    }
    @Test void insufficientConfirmedCapCreatesNoExecution() {
        assertEquals("STUDIO_PRICE_CHANGED",assertThrows(BusinessException.class,()->service.start("u","p",request(29,"原稿"))).getCode());
        assertTrue(rows.isEmpty());
    }
    @Test void readingAnotherOwnersTaskReturnsNotFound() {
        service.start("u","p",request(30,"原稿"));
        assertEquals("STUDIO_VIDEO_TASK_NOT_FOUND",assertThrows(BusinessException.class,()->service.get("other","PEX-one")).getCode());
    }
    @Test void refreshReadsTheSameExecutionWithoutSubmittingWork() {
        service.start("u","p",request(30,"原稿"));
        for(int i=0;i<5;i++)assertEquals("PEX-one",service.get("u","PEX-one").id());
        assertEquals(1,rows.size());verify(workflow,never()).submit(anyString(),anyString(),any());
    }
    @Test void aManualRepairOnTheExecutionNodeIsNotASeparateRecentTask() {
        when(repository.findByOwnerUserIdOrderByCreatedAtDesc(eq("u"),any())).thenReturn(org.springframework.data.domain.Page.empty());
        var repair=com.aistareco.aep.ipstudio.model.IpRun.builder().id("IPR-repair").nodeId("PEX-original-p-video")
                .ownerUserId("u").projectId("p").kind("studio-video").inputJson("{}").build();
        when(nativeRuns.findByOwnerUserIdAndKindOrderByCreatedAtDesc(eq("u"),eq("studio-video"),any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(repair)));
        assertTrue(service.list("u",0).items().isEmpty());
    }
    @Test void nestedLongVideoConfigurationCannotChangeTheConfirmedCap() {
        ObjectNode body=om.valueToTree(request(30,"要求"));body.put("kind","segmented");
        body.putObject("configuration").put("clientRequestId","request-one").put("sceneId","ecom-talking")
                .put("duration",15).put("budgetCap",31).putArray("materials");
        var req=om.convertValue(body,StudioVideoTaskService.Create.class);
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->service.start("u","p",req)).getCode());
        assertTrue(rows.isEmpty());
    }
    @Test void nestedLongPricesReplayAfterTheirPersistedJsonRoundTrip() {
        ObjectNode body=om.valueToTree(request(30,"要求"));body.put("kind","recreation");
        body.putObject("configuration").put("clientRequestId","request-one").put("sceneId","ecom-talking")
                .put("duration",15).put("budgetCap",30L).putArray("materials");
        var req=om.convertValue(body,StudioVideoTaskService.Create.class);
        ObjectNode state=om.createObjectNode();state.putObject("videoTask").put("kind","recreation").set("request",om.valueToTree(req));
        rows.put("PEX-saved",IpPlanExecution.builder().id("PEX-saved").ownerUserId("u").projectId("p").clientRequestId("request-one")
                .status("done").stepsJson(state.toString()).createdAt(Instant.now()).build());
        assertEquals("PEX-saved",service.start("u","p",req).id());
        verify(workflow,never()).quote(anyString(),any());
    }
}
