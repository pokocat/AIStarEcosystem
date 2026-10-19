package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.StudioTemplateDtos.*;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.AdoptResult;
import com.aistareco.aep.ipstudio.model.*;
import com.aistareco.aep.ipstudio.repository.IpProjectRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StudioTemplateMetricsServiceTest {
    final ObjectMapper om=new ObjectMapper();final IpProjectRepository repo=mock(IpProjectRepository.class);
    final IpProjectService projects=mock(IpProjectService.class);final StudioTemplateService templates=mock(StudioTemplateService.class);
    final StudioTemplateExecutionService execution=mock(StudioTemplateExecutionService.class);
    final Version version=new Version("v1","t",1,"pack","","personal",null,null,"today");
    StudioTemplateMetricsService service;
    @BeforeEach void setup()throws Exception {
        service=new StudioTemplateMetricsService(repo,projects,templates,execution);
        when(projects.parseOrEmptyObject(anyString())).thenAnswer(i->om.readTree(i.getArgument(0,String.class)));
        when(projects.toRunDto(any())).thenAnswer(i->{IpRun r=i.getArgument(0);return new IpRunDto(r.getId(),r.getProjectId(),"n","generate",r.getStatus(),"stage",0,r.getCost(),null,null,null,null,"today",null);});
    }
    void job(String project,String id,String status,long cost){when(projects.ownedRun("owner",project,id)).thenReturn(Optional.of(IpRun.builder().id(id).projectId(project).status(status).cost(cost).build()));}
    ExecutionStep step(String id,String status,boolean accepted,AdoptResult adoption){return new ExecutionStep(id,id,"n","main",status,false,8L,new IpRunDto(id,"p","n","generate",status,"stage",0,8,null,null,null,null,"today",null),"own/image",null,accepted,adoption);}
    @Test void historicalReplacementsAndRefundedFailuresUseOriginalJobCostsWithoutDoubleCounting() {
        var one=IpProject.builder().id("p1").templateInstanceJson("{\"templateRequests\":{\"a\":{\"runId\":\"old\",\"stepId\":\"main\"},\"b\":{\"runId\":\"main\",\"stepId\":\"main\"},\"dup\":{\"runId\":\"main\",\"stepId\":\"main\"},\"c\":{\"runId\":\"side\",\"stepId\":\"side\"},\"d\":{\"runId\":\"failed\",\"stepId\":\"side\"},\"e\":{\"runId\":\"running\",\"stepId\":\"detail\"}},\"packages\":[{\"id\":\"pack\"}]}").build();
        var two=IpProject.builder().id("p2").templateInstanceJson("{\"templateRequests\":{\"a\":{\"runId\":\"only\",\"stepId\":\"main\"}}}").build();
        when(repo.findByOwnerUserIdAndTemplateVersionIdAndDeletedAtIsNull("owner","v1")).thenReturn(List.of(one,two));
        when(templates.instance("owner","p1")).thenReturn(new Instance(null,version,null));
        job("p1","old","done",8);job("p1","main","done",8);job("p1","side","done",8);job("p1","failed","failed",0);job("p1","running","running",8);job("p2","only","done",8);
        when(execution.read("owner","p1")).thenReturn(new Execution("v1",1,List.of(step("main","done",true,null),step("side","done",true,new AdoptResult("ip","avatar",1,"own/image","look")),step("detail","running",false,null)),false));
        when(execution.read("owner","p2")).thenReturn(new Execution("v1",1,List.of(step("main","done",true,null)),true));
        var stats=service.read("owner","v1");assertEquals("owner",stats.scope());assertEquals(2,stats.instances());assertEquals(1,stats.completedInstances());assertEquals(3,stats.generatedSteps());assertEquals(3,stats.acceptedSteps());assertEquals(1,stats.firstPassAcceptedSteps());assertEquals(1,stats.failedRuns());assertEquals(1,stats.runningRuns());assertEquals(32,stats.spentCredits());assertEquals(8,stats.pendingCredits());assertEquals(1,stats.packages());assertEquals(1,stats.archivedAssets());
        verify(templates,never()).read(any(),any());verify(projects,times(1)).ownedRun("owner","p1","main");
    }
    @Test void staleAcceptedResultsDoNotCountAsQualifiedCompletion() {
        var p=IpProject.builder().id("p").templateInstanceJson("{}").build();when(repo.findByOwnerUserIdAndTemplateVersionIdAndDeletedAtIsNull("owner","v1")).thenReturn(List.of(p));when(templates.instance("owner","p")).thenReturn(new Instance(null,version,null));
        when(execution.read("owner","p")).thenReturn(new Execution("v1",1,List.of(step("main","stale",true,null)),false));var stats=service.read("owner","v1");assertEquals(0,stats.acceptedSteps());assertEquals(0,stats.completedInstances());assertEquals(0,stats.firstPassAcceptedSteps());
    }
    @Test void emptyCohortStillRequiresVersionAccessAndCannotRevealOtherOwnersUsage() {
        when(repo.findByOwnerUserIdAndTemplateVersionIdAndDeletedAtIsNull("owner","private")).thenReturn(List.of());when(templates.read("owner","private")).thenThrow(BusinessException.notFound("NOT_FOUND","private"));assertThrows(BusinessException.class,()->service.read("owner","private"));verifyNoInteractions(execution);
        when(repo.findByOwnerUserIdAndTemplateVersionIdAndDeletedAtIsNull("owner","v1")).thenReturn(List.of());when(templates.read("owner","v1")).thenReturn(version);assertEquals(0,service.read("owner","v1").instances());
    }
}
