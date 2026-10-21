package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.ipstudio.dialogue.StudioDialogueEvents;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.RunRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.StudioWorkflowService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Budget pre-check, lease, idempotent recovery, pause/cancel/deadline and check handling of the advance entry. */
class StudioPlanExecutorTest {
    final ObjectMapper om=new ObjectMapper();
    IpPlanExecution row;
    final Map<String,IpRunDto> dtos=new HashMap<>();
    final Map<String,IpRun> byRequest=new HashMap<>();
    final List<RunRequest> submitted=new ArrayList<>();
    final List<String> published=new ArrayList<>();
    final List<JsonNode> publishedData=new ArrayList<>();
    IpPlanExecutionRepository executions;IpRunRepository runRepository;IpProjectService projects;StudioWorkflowService workflow;IpRunService runs;
    StudioPlanExecutor executor;com.aistareco.aep.ipstudio.dialogue.StudioDialogueService dialogue;
    java.util.function.Function<RunRequest,String> onSubmit;
    /** Messages the executor posted on its thread: key → [text, blocks, suggestions]. */
    final Map<String,Object[]> posted=new LinkedHashMap<>();
    final List<com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering.Note> notes=new ArrayList<>();
    final List<String> openedTurns=new ArrayList<>();

    @BeforeEach void setUp() {
        executions=mock(IpPlanExecutionRepository.class);runRepository=mock(IpRunRepository.class);projects=mock(IpProjectService.class);
        workflow=mock(StudioWorkflowService.class);runs=mock(IpRunService.class);
        when(executions.findById(anyString())).thenAnswer(i->Optional.ofNullable(row));
        when(executions.lockById(anyString())).thenAnswer(i->Optional.ofNullable(row));
        when(executions.save(any())).thenAnswer(i->i.getArgument(0));
        when(executions.acquireLease(anyString(),anyString(),anyLong(),any(),any())).thenAnswer(i->{
            Instant now=i.getArgument(3);
            if(row.getLeaseVersion()!=(long)i.getArgument(2))return 0;
            if(row.getLeaseUntil()!=null&&!row.getLeaseUntil().isBefore(now)&&!i.getArgument(1).equals(row.getLeaseOwner()))return 0;
            row.setLeaseOwner(i.getArgument(1));row.setLeaseUntil(i.getArgument(4));row.setLeaseVersion(row.getLeaseVersion()+1);return 1;
        });
        when(executions.renewLease(anyString(),anyString(),anyLong(),any())).thenAnswer(i->{
            if(!i.getArgument(1).equals(row.getLeaseOwner())||row.getLeaseVersion()!=(long)i.getArgument(2))return 0;row.setLeaseUntil(i.getArgument(3));return 1;});
        when(executions.releaseLease(anyString(),anyString(),anyLong())).thenAnswer(i->{
            if(!i.getArgument(1).equals(row.getLeaseOwner())||row.getLeaseVersion()!=(long)i.getArgument(2))return 0;row.setLeaseOwner(null);row.setLeaseUntil(null);return 1;});
        when(runRepository.findByProjectIdAndClientRequestId(anyString(),anyString())).thenAnswer(i->Optional.ofNullable(byRequest.get((String)i.getArgument(1))));
        when(projects.ownedRun(eq("u"),eq("p"),anyString())).thenAnswer(i->dtos.containsKey((String)i.getArgument(2))
                ?Optional.of(IpRun.builder().id(i.getArgument(2)).ownerUserId("u").projectId("p").build()):Optional.empty());
        when(projects.toRunDto(any())).thenAnswer(i->dtos.get(((IpRun)i.getArgument(0)).getId()));
        when(projects.required("u","p")).thenReturn(IpProject.builder().id("p").build());
        when(projects.readDoc(any())).thenReturn(om.createObjectNode());
        onSubmit=request->"IPR-"+request.nodeId();
        when(workflow.submit(eq("u"),eq("p"),any())).thenAnswer(i->{
            RunRequest request=i.getArgument(2);submitted.add(request);
            String id=onSubmit.apply(request);
            byRequest.put(request.clientRequestId(),IpRun.builder().id(id).ownerUserId("u").projectId("p").clientRequestId(request.clientRequestId()).build());
            dtos.put(id,dto(id,"running",0,null));
            return dtos.get(id);
        });
        var quoter=mock(StudioPlanQuoter.class);
        when(quoter.modes()).thenReturn(Map.of("omni",new StudioPlanSteps.ModeSpec(false,false,true))::get);
        var manager=mock(PlatformTransactionManager.class);when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        StudioDialogueEvents sink=(thread,turn,run,execution,type,data)->{published.add(type);publishedData.add(data);return published.size();};
        @SuppressWarnings("unchecked") ObjectProvider<StudioDialogueEvents> events=mock(ObjectProvider.class);when(events.getIfAvailable()).thenReturn(sink);
        executor=new StudioPlanExecutor(executions,runRepository,new StudioPlanOutputs(runRepository,projects,om),workflow,runs,projects,quoter,om,manager,events);
        dialogue=mock(com.aistareco.aep.ipstudio.dialogue.StudioDialogueService.class);
        @SuppressWarnings("unchecked") ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioDialogueService> dialogues=mock(ObjectProvider.class);
        when(dialogues.getIfAvailable()).thenReturn(dialogue);
        org.springframework.test.util.ReflectionTestUtils.setField(executor,"dialogue",dialogues);
        com.aistareco.aep.ipstudio.dialogue.StudioExecutionMessages poster=(thread,execution,key,text,blocks,suggestions)->{
            posted.putIfAbsent(key,new Object[]{text,blocks,suggestions});return "IDM-"+key;};
        @SuppressWarnings("unchecked") ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioExecutionMessages> posters=mock(ObjectProvider.class);
        when(posters.getIfAvailable()).thenReturn(poster);
        org.springframework.test.util.ReflectionTestUtils.setField(executor,"messages",posters);
        var steering=new com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering() {
            @Override public List<Note> notes(String threadId,String executionId){return List.copyOf(notes);}
            @Override public void openTurn(String threadId){openedTurns.add(threadId);}
        };
        @SuppressWarnings("unchecked") ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering> steerings=mock(ObjectProvider.class);
        when(steerings.getIfAvailable()).thenReturn(steering);
        org.springframework.test.util.ReflectionTestUtils.setField(executor,"steering",steerings);
    }

    IpRunDto dto(String id,String status,long cost,JsonNode output) {
        return new IpRunDto(id,"p","n","studio-video",status,status,0,cost,"failed".equals(status)?"STUDIO_VIDEO_FAILED":null,"failed".equals(status)?"厂商没有出片":null,
                om.createObjectNode(),output==null?om.createObjectNode():output,Instant.now().toString(),null,null);
    }
    JsonNode videoOutput(String key) {
        var out=om.createObjectNode();out.putArray("videoCandidates").addObject().put("index",0).put("status","done").put("storageKey",key);out.put("storageKey",key);return out;
    }
    ObjectNode videoStep(String id,long quoted,String... depends) {
        var step=om.createObjectNode().put("id",id).put("stage","production").put("title","片段 "+id).put("operation","video").put("execution","auto")
                .put("status","pending").put("attempt",1).put("quotedCost",quoted).put("maxCost",quoted);
        var deps=step.putArray("dependsOn");for(String d:depends)deps.add(d);step.putArray("runIds");
        var def=step.putObject("definition").put("id",id).put("operation","video").put("prompt","出片").put("title","片段 "+id);
        var settings=def.putObject("settings").put("operation","video").put("durationSec",12).put("aspectRatio","9:16").put("count",1);
        settings.putObject("video").put("mode","omni").put("resolutionTier","768p");settings.putArray("referenceBindings");
        return step;
    }
    ObjectNode checkStep(String id,String target,long quoted) {
        var step=om.createObjectNode().put("id",id).put("stage","production").put("title","检查 "+target).put("operation","check").put("execution","auto")
                .put("status","pending").put("attempt",1).put("quotedCost",quoted).put("maxCost",quoted);
        step.putArray("dependsOn").add(target);step.putArray("runIds");
        var settings=step.putObject("definition").put("id",id).put("operation","check").put("prompt","").putObject("settings").put("operation","check").put("targetStepId",target);
        settings.putArray("checkIds").add("subject-replaced");
        return step;
    }
    void execution(String status,long cap,ObjectNode... steps) {
        var state=om.createObjectNode();state.putObject("skill").put("key","reference-video-recreation").put("version",1);state.putArray("canvasContextIds");
        var array=state.putArray("steps");for(var s:steps)array.add(s);
        var budget=om.createObjectNode();budget.putObject("production").put("approvedCap",cap).put("autoFixCap",0).put("spent",0).put("inFlight",0);
        Instant now=Instant.now();
        row=IpPlanExecution.builder().id("PEX-1").projectId("p").ownerUserId("u").threadId("t").skillKey("reference-video-recreation").skillVersion(1)
                .stage("production").planRunId("IPR-plan").planRevision(1).planFingerprint("f").status(status).stepsJson(state.toString()).budgetJson(budget.toString())
                .billingJson("{\"mode\":\"personal\"}").clientRequestId("c").startedAt(now).deadlineAt(now.plusSeconds(5400)).createdAt(now).updatedAt(now).build();
    }
    JsonNode state() throws Exception {return om.readTree(row.getStepsJson());}
    JsonNode step(String id) throws Exception {for(JsonNode s:state().path("steps"))if(id.equals(s.path("id").asText()))return s;return null;}
    JsonNode budget() throws Exception {return om.readTree(row.getBudgetJson()).path("production");}

    @Test void budgetExactlyEnoughSubmitsAndRepeatedWakesNeverDoubleSubmit() throws Exception {
        execution("running",45,videoStep("v1",40),checkStep("c1","v1",5));
        dtos.put("IPR-plan",dto("IPR-plan","done",0,om.readTree("{\"plan\":{\"recommendedApproachId\":\"a\",\"approaches\":[{\"id\":\"a\",\"change\":[\"三位老人换成三个婴儿\"],\"preserve\":[\"客厅场景\"]}]}}")));
        executor.advance("PEX-1");
        assertEquals(1,submitted.size());
        var request=submitted.get(0);
        assertEquals(StudioPlanExecutionIds.requestId("PEX-1","production","v1",1),request.clientRequestId());
        assertEquals(40L,request.maxCost());assertEquals("PEX-1",request.executionId());assertEquals("personal",request.billing().mode());
        assertEquals("running",step("v1").path("status").asText());assertEquals(40,budget().path("inFlight").asLong());
        executor.advance("PEX-1");executor.advance("PEX-1");
        assertEquals(1,submitted.size(),"a running step is never resubmitted");
        dtos.put("IPR-PEX-1-p-v1",dto("IPR-PEX-1-p-v1","done",40,videoOutput("v1.mp4")));
        executor.advance("PEX-1");
        assertEquals(2,submitted.size(),"40 spent + 0 in flight + 5 = 45 ≤ 45");
        assertEquals("check",submitted.get(1).operation());assertEquals("IPR-PEX-1-p-v1",submitted.get(1).check().targetRunId());
        assertEquals("v1.mp4",submitted.get(1).check().targetStorageKey());
        // The checker is told who is replaced by whom (production 2026-10-19: three adult men still passed 「no old subject」).
        String target=submitted.get(1).prompt();
        assertTrue(target.contains("这一段应当呈现：出片")&&target.contains("三位老人换成三个婴儿")&&target.contains("客厅场景"),target);
        assertTrue(published.contains("node.upsert"));assertTrue(published.contains("budget.update"));
        assertNull(row.getLeaseOwner(),"lease released after each advance");
    }

    @Test void oneCreditShortStopsWithTheShortfallAndNothingIsSubmitted() throws Exception {
        execution("running",44,videoStep("v1",40),checkStep("c1","v1",5));
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-v1",dto("IPR-PEX-1-p-v1","done",40,videoOutput("v1.mp4")));
        published.clear();publishedData.clear();
        executor.advance("PEX-1");
        assertEquals(1,submitted.size());
        assertEquals("needs_user",row.getStatus());assertEquals("needs_user",step("c1").path("status").asText());
        assertEquals(1,budget().path("shortfall").asLong());
        int index=published.lastIndexOf("budget.update");assertTrue(index>=0);
        assertEquals(1,publishedData.get(index).path("shortfall").asLong());
        // The raise is a real card on the thread (approvable by the button or in words), not an event-only card.
        assertEquals(1,posted.size());
        var entry=posted.entrySet().iterator().next();
        assertTrue(entry.getKey().startsWith("exec-card-"));
        @SuppressWarnings("unchecked") var blocks=(List<ObjectNode>)entry.getValue()[1];
        var card=blocks.get(0);
        assertEquals("approval",card.path("type").asText());assertEquals("pending",card.path("status").asText());
        assertEquals(45,card.path("budgetCap").asLong());assertEquals(1,card.path("shortfall").asLong());assertEquals("f",card.path("planFingerprint").asText());
        assertEquals("PEX-1",card.path("executionId").asText());
        assertTrue(((String)entry.getValue()[0]).contains("还差 1 积分"));
        assertTrue(state().path("needsUserReason").asText().contains("1 积分"));
        executor.advance("PEX-1");
        assertEquals(1,posted.size(),"one card per shortfall");
    }

    /** The shortfall stop marks its step, so a confirmed raise can release exactly the budget stops (and nothing else). */
    @Test void aBudgetStopMarksItsStepForTheRaise() throws Exception {
        execution("running",44,videoStep("v1",40),checkStep("c1","v1",5));
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-v1",dto("IPR-PEX-1-p-v1","done",40,videoOutput("v1.mp4")));
        executor.advance("PEX-1");
        assertTrue(step("c1").path("budgetBlocked").asBoolean(),"stopped for budget");
        assertFalse(step("v1").has("budgetBlocked"));
    }

    /** Runs of an attempt a revised plan replaced stay charged to the stage, so the new attempt cannot overspend the cap. */
    @Test void earlierAttemptsAReplanReplacedStayInTheStageBudget() throws Exception {
        var v1=videoStep("v1",40);v1.put("attempt",2);v1.putArray("previousRunIds").add("IPR-old");
        execution("running",80,v1);
        dtos.put("IPR-old",dto("IPR-old","done",40,videoOutput("old.mp4")));
        executor.advance("PEX-1");
        assertEquals(1,submitted.size(),"40 spent earlier + 40 for the new attempt = 80 fits");
        assertEquals(StudioPlanExecutionIds.requestId("PEX-1","production","v1",2),submitted.get(0).clientRequestId(),"a new request identity");
        assertEquals(40,budget().path("spent").asLong());assertEquals(40,budget().path("inFlight").asLong());
        execution("running",79,v1);
        submitted.clear();
        executor.advance("PEX-1");
        assertTrue(submitted.isEmpty(),"40 + 40 > 79: the earlier attempt still counts");
        assertEquals(1,budget().path("shortfall").asLong());
    }

    @Test void inFlightRunsOccupyTheirApprovedCeiling() throws Exception {
        execution("running",79,videoStep("v1",40),videoStep("v2",40));
        executor.advance("PEX-1");
        assertEquals(1,submitted.size(),"0 + 40 in flight + 40 = 80 > 79");
        assertEquals("needs_user",step("v2").path("status").asText());assertEquals(1,budget().path("shortfall").asLong());
    }

    @Test void pausedAndPartialOnlyRefresh() throws Exception {
        execution("paused",1000,videoStep("v1",40),videoStep("v2",40));
        executor.advance("PEX-1");
        assertTrue(submitted.isEmpty());assertEquals("paused",row.getStatus());
        execution("running",1000,videoStep("v1",40));row.setDeadlineAt(Instant.now().minusSeconds(1));
        executor.advance("PEX-1");
        assertTrue(submitted.isEmpty());assertEquals("partial",row.getStatus());
        assertTrue(state().path("needsUserReason").asText().contains("尚未执行 1 步"));
    }

    @Test void unknownSubmitOutcomeIsLookedUpBeforeAnyResubmission() throws Exception {
        execution("running",1000,videoStep("v1",40));
        onSubmit=request->{
            byRequest.put(request.clientRequestId(),IpRun.builder().id("IPR-created").ownerUserId("u").projectId("p").build());
            dtos.put("IPR-created",dto("IPR-created","running",0,null));
            throw new IllegalStateException("connection reset after commit");
        };
        executor.advance("PEX-1");
        assertEquals("submitted",step("v1").path("status").asText());assertEquals(40,budget().path("inFlight").asLong(),"kept as a conservative occupation");
        executor.advance("PEX-1");
        assertEquals(1,submitted.size(),"the accepted run is found by its request id, never submitted twice");
        assertEquals("[\"IPR-created\"]",step("v1").path("runIds").toString());assertEquals("running",step("v1").path("status").asText());
    }

    @Test void aLostLeaseNeitherSubmitsNorOverwrites() throws Exception {
        execution("running",1000,videoStep("v1",40),videoStep("v2",40));
        row.setLeaseOwner("other");row.setLeaseUntil(Instant.now().plusSeconds(60));
        executor.advance("PEX-1");
        assertTrue(submitted.isEmpty());
        row.setLeaseOwner(null);row.setLeaseUntil(null);
        // A control (pause/stop/accept) preempts the holder mid-submit: version bump and lease cleared.
        onSubmit=request->{row.setLeaseVersion(row.getLeaseVersion()+1);row.setLeaseOwner(null);row.setLeaseUntil(null);return "IPR-"+request.nodeId();};
        executor.advance("PEX-1");
        assertEquals(1,submitted.size(),"stops at the next write after losing the lease");
        assertEquals("submitted",step("v1").path("status").asText(),"the preempted holder did not record anything");
        executor.advance("PEX-1");
        assertEquals("running",step("v1").path("status").asText(),"the next holder attaches the accepted run by request id");
    }

    @Test void failedChecksAndRejectionsStopForTheUser() throws Exception {
        execution("running",1000,videoStep("v1",40),checkStep("c1","v1",5),videoStep("v2",40,"c1"));
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-v1",dto("IPR-PEX-1-p-v1","done",40,videoOutput("v1.mp4")));
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-c1",dto("IPR-PEX-1-p-c1","done",3,om.readTree("{\"check\":{\"status\":\"fail\",\"items\":[]}}")));
        executor.advance("PEX-1");
        assertEquals("needs_user",row.getStatus());assertEquals("fail",step("c1").path("checkStatus").asText());
        assertEquals(2,submitted.size(),"no new paid step after a failed check (no auto-fix in this version)");
        execution("running",1000,videoStep("v1",40));
        when(workflow.submit(eq("u"),eq("p"),any())).thenThrow(new BusinessException(HttpStatus.CONFLICT,"STUDIO_PRICE_CHANGED","价格已变化"));
        executor.advance("PEX-1");
        assertEquals("needs_user",row.getStatus());assertEquals("STUDIO_PRICE_CHANGED",step("v1").path("errorCode").asText());
        assertFalse(step("v1").has("pendingRequestId"));
    }

    @Test void cancelStopsPendingStepsAndAsksQueuedRunsToStopOnce() throws Exception {
        execution("running",1000,videoStep("v1",40),videoStep("v2",40,"v1"));
        executor.advance("PEX-1");
        row.setStatus("canceled");
        when(runs.cancel("u","IPR-PEX-1-p-v1")).thenThrow(BusinessException.badRequest("STUDIO_VIDEO_ALREADY_SUBMITTED","已交给生成引擎"));
        executor.advance("PEX-1");executor.advance("PEX-1");
        verify(runs,times(1)).cancel("u","IPR-PEX-1-p-v1");
        assertEquals("skipped",step("v2").path("status").asText());assertEquals("running",step("v1").path("status").asText());
        assertEquals(40,budget().path("inFlight").asLong(),"the provider-held run keeps its occupation until it settles");
        assertEquals(1,submitted.size());
    }

    @Test void productionCompletesOnlyWhenEveryCheckIsResolved() throws Exception {
        execution("running",1000,videoStep("v1",40),checkStep("c1","v1",5));
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-v1",dto("IPR-PEX-1-p-v1","done",40,videoOutput("v1.mp4")));
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-c1",dto("IPR-PEX-1-p-c1","done",3,om.readTree("{\"check\":{\"status\":\"pass\",\"items\":[]}}")));
        executor.advance("PEX-1");
        assertEquals("done",row.getStatus());assertNotNull(row.getFinishedAt());
        verify(dialogue).bindExecution("t",null,null);
        assertEquals(43,budget().path("spent").asLong());assertEquals(0,budget().path("inFlight").asLong());
        JsonNode video=null,check=null;
        for(int i=0;i<published.size();i++)if("node.upsert".equals(published.get(i))) {
            JsonNode data=publishedData.get(i);
            if("PEX-1-p-v1".equals(data.path("nodeId").asText()))video=data;
            if("PEX-1-p-c1".equals(data.path("nodeId").asText()))check=data;
        }
        assertEquals("v1.mp4",video.path("node").path("metadata").path("storageKey").asText(),"the real output key, never a URL");
        assertEquals("check",check.path("node").path("metadata").path("studio").path("kind").asText());
        assertEquals("pass",check.path("node").path("metadata").path("studio").path("check").path("status").asText());
        assertEquals("片段 v1 · 检查",check.path("node").path("title").asText());
        assertEquals("PEX-1-p-v1",check.path("connection").path("fromNodeId").asText(),"connected from the inspected video");
        assertEquals("IPR-PEX-1-p-c1",check.path("node").path("metadata").path("studio").path("execution").path("runId").asText());
    }

    @Test void aFilmStudyLinksTheReferenceFilmToItsAnalysisAndMarksEachCutAsSourceMaterial() throws Exception {
        var step=om.createObjectNode().put("id","r1").put("stage","production").put("title","拉片").put("operation","recreation").put("execution","auto")
                .put("status","pending").put("attempt",1).put("quotedCost",5).put("maxCost",5);
        step.putArray("dependsOn");step.putArray("runIds");
        step.putObject("definition").put("id","r1").put("operation","recreation").put("prompt","分段拉片").putObject("settings").put("operation","recreation")
                .put("sourceNodeId","vid-ref").put("mode","segments").put("maxSegmentSec","model").put("videoModel","ep-h3");
        execution("running",100,step);
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-r1",dto("IPR-PEX-1-p-r1","done",5,om.readTree(
                "{\"text\":\"分析\",\"filmStudy\":{\"segments\":[{\"no\":1,\"title\":\"开场\",\"storageKey\":\"cut1.mp4\",\"startSec\":0,\"endSec\":5}]}}")));
        executor.advance("PEX-1");
        JsonNode link=null,cut=null;
        for(int i=0;i<published.size();i++)if("node.upsert".equals(published.get(i))) {
            JsonNode data=publishedData.get(i);
            if("vid-ref".equals(data.path("connection").path("fromNodeId").asText()))link=data;
            if(data.path("node").path("metadata").path("studio").has("sourceRange"))cut=data;
        }
        assertNotNull(link,"the reference film is linked to its analysis");
        assertEquals("PEX-1-p-r1",link.path("connection").path("toNodeId").asText());
        assertEquals("cut1.mp4",cut.path("node").path("metadata").path("studio").path("sourceRange").path("storageKey").asText());
    }

    // ── D03: steering at the safe boundary ──────────────────────────────────────────────────────────────────
    @Test void aMessageSentWhileRunningStopsTheNextSubmissionAndOpensItsReplyOnce() throws Exception {
        execution("running",1000,videoStep("v1",40),videoStep("v2",40,"v1"));
        executor.advance("PEX-1");
        assertEquals(1,submitted.size());
        notes.add(new com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering.Note("IDS-1","IDM-1","第二步不要执行，只保留第一步","queued",Instant.now()));
        dtos.put("IPR-PEX-1-p-v1",dto("IPR-PEX-1-p-v1","done",40,videoOutput("v1.mp4")));
        executor.advance("PEX-1");
        assertEquals(1,submitted.size(),"the old second step is not submitted after the change request");
        assertEquals("needs_user",row.getStatus());
        assertTrue(state().path("needsUserReason").asText().startsWith("收到新指令，等待重新确认"));
        assertEquals("done",step("v1").path("status").asText(),"the accepted task keeps its snapshot and result");
        assertEquals(List.of("t"),openedTurns,"the dialogue answers the message");
        executor.advance("PEX-1");executor.advance("PEX-1");
        assertEquals(List.of("t"),openedTurns,"each steering message is handled once");
        assertEquals("[\"IDS-1\"]",state().path("steeringSeen").toString());
        row.setStatus("running"); // the user's explicit continue (resume) after reading the reply
        executor.advance("PEX-1");
        assertEquals(2,submitted.size(),"an explicit continue resumes the plan");
    }

    @Test void rejectedSteeringIsIgnored() throws Exception {
        execution("running",1000,videoStep("v1",40));
        notes.add(new com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering.Note("IDS-9","IDM-9","算了","rejected",Instant.now()));
        executor.advance("PEX-1");
        assertEquals(1,submitted.size());assertTrue(openedTurns.isEmpty());
    }

    // ── D06: parent dialogue turns count in their stage ─────────────────────────────────────────────────────
    @Test void dialogueTurnsCountInTheStageBudgetOnceWithTheParentShareVisible() throws Exception {
        execution("running",60,videoStep("v1",40));
        var state=(ObjectNode)state();
        var turns=state.putArray("dialogueRuns");
        turns.addObject().put("runId","IPR-turn").put("stage","production").put("maxCost",28).put("status","running");
        turns.addObject().put("runId","IPR-turn").put("stage","production").put("maxCost",28).put("status","running"); // a duplicated registration
        row.setStepsJson(state.toString());
        dtos.put("IPR-turn",dto("IPR-turn","running",28,null));
        executor.advance("PEX-1");
        assertTrue(submitted.isEmpty(),"0 + 28 (the running turn) + 40 > 60");
        assertEquals("needs_user",row.getStatus());
        assertEquals(28,budget().path("inFlight").asLong(),"one run id, counted once");
        assertEquals(28,budget().path("dialogueInFlight").asLong());
        assertEquals(8,budget().path("shortfall").asLong());
        dtos.put("IPR-turn",dto("IPR-turn","done",2,null));
        var resumed=(ObjectNode)state();((ObjectNode)resumed.path("steps").get(0)).put("status","pending"); // what resume does
        row.setStepsJson(resumed.toString());row.setStatus("running");
        published.clear();publishedData.clear();
        executor.advance("PEX-1");
        assertEquals(1,submitted.size(),"2 settled + 40 ≤ 60");
        assertEquals(2,budget().path("spent").asLong());assertEquals(2,budget().path("dialogueSpent").asLong());assertEquals(0,budget().path("dialogueInFlight").asLong());
        var update=publishedData.get(published.indexOf("budget.update"));
        assertEquals(2,update.path("spent").asLong());assertEquals(2,update.path("dialogueSpent").asLong(),"the parent share is visible, already inside spent");
    }

    // ── D07: completion summary ─────────────────────────────────────────────────────────────────────────────
    @Test void aFinishedExecutionPostsOneSummaryWithRealCostsChecksAndSuggestions() throws Exception {
        execution("running",1000,videoStep("v1",40),checkStep("c1","v1",5));
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-v1",dto("IPR-PEX-1-p-v1","done",38,videoOutput("v1.mp4")));
        executor.advance("PEX-1");
        dtos.put("IPR-PEX-1-p-c1",dto("IPR-PEX-1-p-c1","done",3,om.readTree("{\"check\":{\"status\":\"unknown\",\"items\":[{\"id\":\"subject-replaced\",\"status\":\"unknown\",\"reason\":\"四帧看不清商品标签\"}]}}")));
        executor.advance("PEX-1");
        assertEquals("needs_user",row.getStatus(),"an unknown check waits for the user");
        assertTrue(posted.isEmpty(),"no summary before a terminal state");
        var state=(ObjectNode)state();((ObjectNode)state.path("steps").get(1)).put("acknowledged",true);row.setStepsJson(state.toString());
        executor.advance("PEX-1");
        assertEquals("done",row.getStatus());
        var summary=posted.get("exec-summary-PEX-1");
        assertNotNull(summary);
        String text=(String)summary[0];
        // One sentence with the real total (38 + 3), then only what still needs the user: the check that could not judge.
        assertTrue(text.startsWith("做好了，花了 41 积分。"),text);
        assertTrue(text.contains("「片段 v1」没法判断：四帧看不清商品标签。"),text);
        // What finished is not listed again (the step list in the timeline has it, with 「在画布上看」), and no stage breakdown.
        assertFalse(text.contains("做完的步骤"),text);
        assertFalse(text.contains("每一步的结果都在画布上"),text);
        assertFalse(text.contains("制作 41"),text);
        assertFalse(text.contains("AI 判断"),text);
        assertFalse(text.contains("——"));
        @SuppressWarnings("unchecked") var suggestions=(List<String>)summary[2];
        assertTrue(suggestions.size()>=2&&suggestions.size()<=3,suggestions.toString());
        assertEquals("重做第 1 段「片段 v1」",suggestions.get(0),"derived from the check that did not pass");
        assertFalse(suggestions.contains("把做好的片段合成一条成片"),"one clip has nothing to join: "+suggestions);
        assertTrue(suggestions.contains("把这张画布存为模板"),suggestions.toString());
        executor.advance("PEX-1");
        assertEquals(1,posted.size(),"one summary per execution");
    }

    @Test void aCanceledExecutionAlsoGetsItsSummary() throws Exception {
        execution("running",1000,videoStep("v1",40),videoStep("v2",40,"v1"));
        executor.advance("PEX-1");
        row.setStatus("canceled");
        executor.advance("PEX-1");executor.advance("PEX-1");
        var summary=posted.get("exec-summary-PEX-1");
        assertNotNull(summary);
        String text=(String)summary[0];
        assertTrue(text.startsWith("已停止，花了 0 积分。还有部分积分在结算。"),text);
        assertTrue(text.contains("没做完：「片段 v1」「片段 v2」。"),text);
        assertEquals(1,posted.keySet().stream().filter(k->k.startsWith("exec-summary")).count());
    }
}
