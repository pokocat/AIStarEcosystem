package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dialogue.StudioDialogueEvents;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Dialogue child runs are authorized against the same stage budget and registered before they are submitted. */
class StudioPlanExecutionBridgeTest {
    final ObjectMapper om=new ObjectMapper();
    IpPlanExecution row;StudioWorkflowService workflow;IpProjectService projects;StudioPlanExecutionBridge bridge;

    @BeforeEach void setUp() throws Exception {
        var executions=mock(IpPlanExecutionRepository.class);
        when(executions.lockById(anyString())).thenAnswer(i->Optional.ofNullable(row));
        when(executions.save(any())).thenAnswer(i->i.getArgument(0));
        workflow=mock(StudioWorkflowService.class);when(workflow.quote(eq("u"),any())).thenReturn(21L);
        projects=mock(IpProjectService.class);
        String file;try(var in=getClass().getResourceAsStream("/studio/skills/reference-video-recreation.md")){file=new String(in.readAllBytes(),StandardCharsets.UTF_8);}
        var skill=StudioSkillCatalog.parse(file);var catalog=mock(StudioSkillCatalog.class);when(catalog.requireForNewWork(skill.key())).thenReturn(skill);
        @SuppressWarnings("unchecked") ObjectProvider<StudioSkillCatalog> catalogs=mock(ObjectProvider.class);when(catalogs.getIfAvailable()).thenReturn(catalog);
        @SuppressWarnings("unchecked") ObjectProvider<StudioDialogueEvents> events=mock(ObjectProvider.class);
        bridge=new StudioPlanExecutionBridge(executions,workflow,mock(StudioPlanQuoter.class),new StudioSkillRules(catalogs),projects,events,om);
        var state=om.createObjectNode();state.set("skill",StudioSkillRules.snapshot(StudioSkillRules.rules(skill)));state.putArray("steps");
        var budget=om.createObjectNode();budget.putObject("analysis").put("approvedCap",30).put("spent",0).put("inFlight",0);
        row=IpPlanExecution.builder().id("PEX-1").projectId("p").ownerUserId("u").skillKey(skill.key()).skillVersion(1).stage("analysis").planRunId("r")
                .planRevision(1).planFingerprint("f").status("running").stepsJson(state.toString()).budgetJson(budget.toString())
                .billingJson("{\"mode\":\"personal\"}").clientRequestId("c").createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }
    RunRequest child(String id,String operation) {
        return new RunRequest(id,"report",operation,"看结构",null,null,null,null,null,null,null,null,"segments",List.of("src"),null,null,null,null,null,null,null,null);
    }

    @Test void childrenShareTheStageBudgetAndAreRegisteredBeforeSubmission() throws Exception {
        var authorized=bridge.authorizeChild("u","p","PEX-1","analysis",child("dlg-1","recreation"));
        assertEquals(21L,authorized.maxCost());assertEquals("PEX-1",authorized.executionId());assertEquals("personal",authorized.billing().mode());
        assertEquals("dlg-1",authorized.clientRequestId());
        assertEquals(21,om.readTree(row.getBudgetJson()).path("analysis").path("inFlight").asLong());
        assertEquals(21L,bridge.authorizeChild("u","p","PEX-1","analysis",child("dlg-1","recreation")).maxCost(),"replay keeps the approved ceiling");
        verify(workflow,times(1)).quote(eq("u"),any());
        var over=assertThrows(BusinessException.class,()->bridge.authorizeChild("u","p","PEX-1","analysis",child("dlg-2","recreation")));
        assertEquals("STUDIO_PLAN_BUDGET_EXCEEDED",over.getCode());assertEquals(12,((JsonNode)over.getDetails()).path("shortfall").asLong());
        assertEquals(1,om.readTree(row.getStepsJson()).path("children").size());
        assertEquals("STUDIO_SKILL_OPERATION_NOT_ALLOWED",assertThrows(BusinessException.class,()->bridge.authorizeChild("u","p","PEX-1","analysis",child("dlg-3","video"))).getCode());
        when(projects.ownedRun("u","p","IPR-x")).thenReturn(Optional.of(IpRun.builder().id("IPR-x").clientRequestId("other").build()));
        assertThrows(BusinessException.class,()->bridge.childAccepted("u","p","PEX-1","dlg-1","IPR-x"));
        when(projects.ownedRun("u","p","IPR-1")).thenReturn(Optional.of(IpRun.builder().id("IPR-1").clientRequestId("dlg-1").build()));
        bridge.childAccepted("u","p","PEX-1","dlg-1","IPR-1");
        assertEquals("IPR-1",om.readTree(row.getStepsJson()).path("children").get(0).path("runId").asText());
        row.setStatus("paused");
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->bridge.authorizeChild("u","p","PEX-1","analysis",child("dlg-4","text"))).getCode());
    }

    /** D06: a turn bound to the execution is checked with its own ceiling as the quote and registered once. */
    @Test void aBoundDialogueTurnIsAttributedToTheStageOrRefusedWithTheShortfall() throws Exception {
        assertEquals("analysis",bridge.attributeTurn("u","p","PEX-1","IPR-turn-1",14));
        var budget=om.readTree(row.getBudgetJson()).path("analysis");
        assertEquals(14,budget.path("inFlight").asLong());assertEquals(14,budget.path("dialogueInFlight").asLong());
        var turn=om.readTree(row.getStepsJson()).path("dialogueRuns").get(0);
        assertEquals("IPR-turn-1",turn.path("runId").asText());assertEquals(14,turn.path("maxCost").asLong());
        assertEquals("analysis",bridge.attributeTurn("u","p","PEX-1","IPR-turn-1",14),"a replay registers nothing new");
        assertEquals(14,om.readTree(row.getBudgetJson()).path("analysis").path("inFlight").asLong());
        var over=assertThrows(BusinessException.class,()->bridge.attributeTurn("u","p","PEX-1","IPR-turn-2",20));
        assertEquals("STUDIO_PLAN_BUDGET_EXCEEDED",over.getCode());assertEquals(402,over.getStatus().value());
        assertEquals(4,((JsonNode)over.getDetails()).path("shortfall").asLong(),"14 in flight + 20 − 30");
        assertEquals(1,om.readTree(row.getStepsJson()).path("dialogueRuns").size(),"a refused turn is not registered");
        row.setStatus("done");
        assertNull(bridge.attributeTurn("u","p","PEX-1","IPR-turn-3",1),"a finished execution no longer owns the thread's turns");
        assertNull(bridge.attributeTurn("someone-else","p","PEX-1","IPR-turn-4",1));
    }
}
