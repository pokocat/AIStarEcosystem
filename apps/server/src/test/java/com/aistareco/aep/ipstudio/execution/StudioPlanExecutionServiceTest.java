package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dialogue.StudioDialogueApprovals;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.*;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.ipstudio.skill.StudioSkill;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Stage confirmation, idempotency, single active execution, payer binding, resume budget check and adoption. */
class StudioPlanExecutionServiceTest {
    final ObjectMapper om=new ObjectMapper();
    final Map<String,IpPlanExecution> rows=new LinkedHashMap<>();
    final Map<String,IpRun> runs=new HashMap<>();
    IpProjectService projects;StudioPlanOutputs outputs;StudioPlanExecutor executor;StudioPlanExecutionService service;StudioSkillRules.Rules rules;
    FakeCards cards;
    com.aistareco.aep.ipstudio.skill.StudioSkill originalSkill;

    /**
     * The dialogue's card store as the execution service sees it: cards by (message, approvalId), the thread's current
     * plan, and the snapshots written on approval. Lookups mirror the real 404 / 409 contract.
     */
    static final class FakeCards implements StudioDialogueApprovals {
        final ObjectMapper om=new ObjectMapper();
        final Map<String,ObjectNode> cards=new LinkedHashMap<>();
        final Map<String,String> userTexts=new HashMap<>();
        final List<Approved> approved=new ArrayList<>();
        final List<String> approvedCards=new ArrayList<>();
        String currentFingerprint,currentRunId;int currentRevision=3;
        ObjectNode put(String messageId,String approvalId,String stage,String fingerprint,long quoted,long cap) {
            var block=om.createObjectNode().put("type","approval").put("approvalId",approvalId).put("stage",stage).put("planFingerprint",fingerprint)
                    .put("quotedCost",quoted).put("budgetCap",cap).put("autoFixCap",0).put("status","pending");
            block.putObject("billingSelection").put("mode","personal");
            cards.put(messageId+"|"+approvalId,block);
            return block;
        }
        Card card(String messageId,ObjectNode block,String approvingId) {
            if(!"pending".equals(block.path("status").asText()))throw StudioPlanExecutionService.stale("这张确认卡已过期或被新方案替代");
            return new Card(block.deepCopy(),"thread-1",messageId,approvingId,approvingId==null?null:userTexts.get(approvingId),
                    currentRunId,currentRevision,currentFingerprint,currentRevision);
        }
        @Override public Card requireApproval(String userId,String projectId,String messageId,String approvalId) {
            var block=cards.get(messageId+"|"+approvalId);
            if(block==null)throw BusinessException.notFound("STUDIO_APPROVAL_NOT_FOUND","找不到这张确认卡");
            return card(messageId,block,null);
        }
        @Override public Card requireApprovalByMessage(String userId,String projectId,String userMessageId,String approvalId) {
            if(!userTexts.containsKey(userMessageId))throw BusinessException.notFound("STUDIO_MESSAGE_NOT_FOUND","找不到这条确认消息");
            for(var e:cards.entrySet())if(e.getKey().endsWith("|"+approvalId))return card(e.getKey().substring(0,e.getKey().indexOf('|')),e.getValue(),userMessageId);
            throw BusinessException.notFound("STUDIO_APPROVAL_NOT_FOUND","找不到这张确认卡");
        }
        @Override public void markApproved(String userId,String projectId,Card card,Approved snapshot) {
            approved.add(snapshot);approvedCards.add(card.cardMessageId()+"|"+card.block().path("approvalId").asText());
            cards.get(card.cardMessageId()+"|"+card.block().path("approvalId").asText()).put("status","approved");
        }
    }

    StudioSkillCatalog catalog;
    /** Plan sources beyond the native runs (the dialogue's in production); empty unless a test adds one. */
    final List<StudioPlanSource> extraSources=new ArrayList<>();
    @BeforeEach void setUp() throws Exception {
        var executions=mock(IpPlanExecutionRepository.class);
        when(executions.findById(anyString())).thenAnswer(i->Optional.ofNullable(rows.get((String)i.getArgument(0))));
        when(executions.lockById(anyString())).thenAnswer(i->Optional.ofNullable(rows.get((String)i.getArgument(0))));
        when(executions.saveAndFlush(any())).thenAnswer(i->{IpPlanExecution e=i.getArgument(0);rows.put(e.getId(),e);return e;});
        when(executions.save(any())).thenAnswer(i->{IpPlanExecution e=i.getArgument(0);rows.put(e.getId(),e);return e;});
        when(executions.findByOwnerUserIdAndClientRequestId(anyString(),anyString())).thenAnswer(i->rows.values().stream()
                .filter(e->e.getOwnerUserId().equals(i.getArgument(0))&&e.getClientRequestId().equals(i.getArgument(1))).findFirst());
        when(executions.findByProjectIdAndStatusIn(anyString(),anyCollection())).thenAnswer(i->rows.values().stream()
                .filter(e->e.getProjectId().equals(i.getArgument(0))&&((Collection<?>)i.getArgument(1)).contains(e.getStatus())).toList());
        projects=mock(IpProjectService.class);
        when(projects.requiredForUpdate("u","p")).thenReturn(IpProject.builder().id("p").build());
        when(projects.required("u","p")).thenReturn(IpProject.builder().id("p").build());
        when(projects.ownedRun(eq("u"),eq("p"),anyString())).thenAnswer(i->Optional.ofNullable(runs.get((String)i.getArgument(2))));
        String file;
        try(var in=getClass().getResourceAsStream("/studio/skills/reference-video-recreation.md")){file=new String(in.readAllBytes(),StandardCharsets.UTF_8);}
        catalog=mock(StudioSkillCatalog.class);var skill=StudioSkillCatalog.parse(file);
        String original;
        try(var in=getClass().getResourceAsStream("/studio/skills/original-creation.md")){original=new String(in.readAllBytes(),StandardCharsets.UTF_8);}
        originalSkill=StudioSkillCatalog.parse(original);
        when(catalog.requireForNewWork("original-creation")).thenReturn(originalSkill);when(catalog.find("original-creation")).thenReturn(Optional.of(originalSkill));
        when(catalog.requireForNewWork("reference-video-recreation")).thenReturn(skill);when(catalog.find("reference-video-recreation")).thenReturn(Optional.of(skill));
        @SuppressWarnings("unchecked") ObjectProvider<StudioSkillCatalog> catalogs=mock(ObjectProvider.class);when(catalogs.getIfAvailable()).thenReturn(catalog);
        var skills=new StudioSkillRules(catalogs);rules=StudioSkillRules.rules(skill);
        outputs=mock(StudioPlanOutputs.class);executor=mock(StudioPlanExecutor.class);
        @SuppressWarnings("unchecked") ObjectProvider<StudioPlanExecutor> executors=mock(ObjectProvider.class);when(executors.getIfAvailable()).thenReturn(executor);
        @SuppressWarnings("unchecked") ObjectProvider<StudioPlanSource> sources=mock(ObjectProvider.class);when(sources.orderedStream()).thenAnswer(i->extraSources.stream());
        service=new StudioPlanExecutionService(executions,projects,skills,outputs,executors,sources,om);
        cards=new FakeCards();
        @SuppressWarnings("unchecked") ObjectProvider<StudioDialogueApprovals> provider=mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(cards);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"approvals",provider);
    }

    /** A native planning run with a normalized, quoted, fingerprinted plan. */
    /** A plan run that is also the thread's current plan, with its pending card on assistant message {@code msg-<runId>}. */
    String currentPlan(String id,String stage,String raw,long... quotes) throws Exception {
        String fp=planRun(id,stage,raw,quotes);
        cards.currentFingerprint=fp;cards.currentRunId=id;
        long total=0;for(long q:quotes)total+=q;
        cards.put("msg-"+id,"APV-"+id,stage,fp,total,total);
        return fp;
    }
    String planRun(String id,String stage,String raw,long... quotes) throws Exception {
        var plan=StudioPlanValidator.validateSkillPlan(om.readTree(raw),rules,stage,List.of("src","product"));
        plan.put("skillKey",rules.key()).put("skillVersion",rules.version()).put("stage",stage).put("revision",3);
        long total=0;for(int i=0;i<quotes.length;i++){((ObjectNode)plan.path("steps").get(i)).put("quotedCost",quotes[i]);total+=quotes[i];}
        plan.putObject("budget").put("estimated",total).put("autoFixCap",0);
        String fingerprint=StudioPlanValidator.fingerprint(plan);plan.put("fingerprint",fingerprint);
        var output=om.createObjectNode();output.set("plan",plan);
        var input=om.createObjectNode();input.putArray("contextNodeIds").add("src").add("product");input.putObject("dialogue").put("threadId","thread-1").put("messageId","m");
        input.putObject("_exec").set("skill",StudioSkillRules.snapshot(rules));
        runs.put(id,IpRun.builder().id(id).projectId("p").ownerUserId("u").kind("studio-text").status("done").inputJson(input.toString()).outputJson(output.toString()).build());
        return fingerprint;
    }
    static final String ANALYSIS="{\"summary\":\"拉片\",\"steps\":[{\"id\":\"cut\",\"operation\":\"recreation\",\"title\":\"拉片\",\"prompt\":\"看结构\",\"settings\":{\"sourceNodeId\":\"src\",\"mode\":\"segments\",\"maxSegmentSec\":\"model\",\"videoModel\":\"ep-h3\"}},"
            +"{\"id\":\"compile\",\"operation\":\"text\",\"title\":\"编排\",\"prompt\":\"编排制作\",\"settings\":{\"purpose\":\"plan-compile\"}}],\"questions\":[]}";
    static final String PRODUCTION="{\"summary\":\"出片\",\"recommendedApproachId\":\"rewrite\",\"approaches\":[{\"id\":\"rewrite\",\"title\":\"改写\",\"summary\":\"保留骨架\",\"rationale\":\"换商品\"}],"
            +"\"steps\":[{\"id\":\"v1\",\"operation\":\"video\",\"title\":\"第一段\",\"prompt\":\"开播\",\"settings\":{\"video\":{\"mode\":\"omni\",\"resolutionTier\":\"768p\"},\"durationSec\":12,\"aspectRatio\":\"9:16\",\"count\":1,"
            +"\"referenceBindings\":[{\"nodeId\":\"product\",\"role\":\"product\",\"order\":0}]}},{\"id\":\"c1\",\"operation\":\"check\",\"title\":\"检查\",\"settings\":{\"targetStepId\":\"v1\",\"checkIds\":[\"subject-replaced\"]}}],\"questions\":[]}";
    PlanExecutionCreateRequest analysisRequest(String fingerprint,long cap) {
        return new PlanExecutionCreateRequest("create-1","analysis","IPR-a",fingerprint,null,cap,0L,null,null,null,"APV-IPR-a","msg-IPR-a");
    }

    @Test void analysisExecutionIsCreatedOnceWithAnImmutablePayerAndWokenAfterCommit() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        assertEquals("running",created.status());assertEquals("analysis",created.stage());assertEquals("thread-1",created.threadId());
        assertEquals(2,created.steps().size());assertEquals("pending",created.steps().get(0).status());
        assertEquals(created.id()+"-a-cut",created.steps().get(0).nodeId());
        assertEquals("personal",created.billing().mode());assertEquals(30,created.budgets().get(0).approvedCap());
        verify(executor).wake(created.id());
        assertEquals(created.id(),service.create("u","p",analysisRequest(fp,30)).id(),"same request replays");
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.create("u","p",analysisRequest(fp,31))).getCode());
        cards.put("msg-again","APV-again","analysis",fp,30,30);
        var other=new PlanExecutionCreateRequest("create-2","analysis","IPR-a",fp,null,30L,0L,null,null,null,"APV-again","msg-again");
        assertEquals("STUDIO_PLAN_EXECUTION_BUSY",assertThrows(BusinessException.class,()->service.create("u","p",other)).getCode());
    }

    @Test void quotesAboveTheCapAndStalePlansAreRefusedBeforeAnything() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var over=assertThrows(BusinessException.class,()->service.create("u","p",analysisRequest(fp,29)));
        assertEquals("STUDIO_PLAN_BUDGET_EXCEEDED",over.getCode());assertEquals(402,over.getStatus().value());
        var details=(JsonNode)over.getDetails();
        assertEquals(1,details.path("shortfall").asLong());assertEquals(30,details.path("quotedCost").asLong());assertEquals(29,details.path("approvedCap").asLong());
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",analysisRequest("forged",30))).getCode());
        var foreign=new PlanExecutionCreateRequest("create-3","analysis","IPR-not-mine",fp,null,30L,0L,null,null,null,"APV-IPR-a","msg-IPR-a");
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",foreign)).getCode());
        var production=new PlanExecutionCreateRequest("create-4","production","IPR-a",fp,null,30L,0L,null,null,null,"APV-IPR-a","msg-IPR-a");
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->service.create("u","p",production)).getCode(),"production is confirmed on the analysis execution");
        assertTrue(rows.isEmpty());verifyNoInteractions(executor);assertTrue(cards.approved.isEmpty());
    }

    @Test void productionIsConfirmedOnTheSameExecutionOnlyForTheConfirmedApproachAndRevision() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        String pf=currentPlan("IPR-b","production",PRODUCTION,40,5);
        cards.put("msg-2","APV-2","production",pf,45,45);
        java.util.function.Function<String[],PlanExecutionCreateRequest> confirm=a->new PlanExecutionCreateRequest(a[0],"production","IPR-b",pf,a[1],45L,0L,
                a[2]==null?null:new BillingSelection(a[2],"ent-1"),created.id(),Integer.valueOf(a[3]),"APV-2",a[4]);
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",confirm.apply(new String[]{"c-1","rewrite",null,"3","msg-2"}))).getCode(),"analysis not finished");
        var row=rows.get(created.id());var state=(ObjectNode)om.readTree(row.getStepsJson());
        state.path("steps").forEach(s->((ObjectNode)s).put("status","done"));row.setStepsJson(state.toString());row.setStatus("needs_user");
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",confirm.apply(new String[]{"c-2","other",null,"3","msg-2"}))).getCode());
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",confirm.apply(new String[]{"c-3","rewrite",null,"2","msg-2"}))).getCode());
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->service.create("u","p",confirm.apply(new String[]{"c-4","rewrite",null,"3",null}))).getCode());
        assertEquals("BILLING_SELECTION_CONFLICT",assertThrows(BusinessException.class,()->service.create("u","p",confirm.apply(new String[]{"c-5","rewrite","enterprise","3","msg-2"}))).getCode());
        var confirmed=service.create("u","p",confirm.apply(new String[]{"c-6","rewrite",null,"3","msg-2"}));
        assertEquals("production",confirmed.stage());assertEquals("running",confirmed.status());assertEquals("IPR-b",confirmed.planRunId());
        assertEquals(4,confirmed.steps().size());assertEquals(2,confirmed.budgets().size());assertEquals(45,confirmed.budgets().get(1).approvedCap());
        assertEquals(confirmed.id(),created.id(),"no second active execution");
        assertEquals("production",service.create("u","p",confirm.apply(new String[]{"c-6","rewrite",null,"3","msg-2"})).stage(),"confirmation replay is idempotent");
    }

    @Test void aDialoguePlanIsConfirmedThroughItsApprovalCardAndBindsTheThread() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var run=runs.get("IPR-a");run.setKind("studio-dialogue");
        var repriced=cards.put("msg-cheap","APV-cheap","analysis",fp,25,30);
        var cheap=new PlanExecutionCreateRequest("create-cheap","analysis","IPR-a",fp,null,30L,0L,null,null,null,"APV-cheap","msg-cheap");
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",cheap)).getCode(),"the card must show the current quote");
        assertEquals(25,repriced.path("quotedCost").asLong());
        assertTrue(cards.approved.isEmpty());
        var created=service.create("u","p",analysisRequest(fp,30));
        assertEquals("thread-1",created.threadId());
        assertEquals(List.of("msg-IPR-a|APV-IPR-a"),cards.approvedCards);
        var dialogue=mock(com.aistareco.aep.ipstudio.dialogue.StudioDialogueService.class);
        @SuppressWarnings("unchecked") ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioDialogueService> dialogues=mock(ObjectProvider.class);
        when(dialogues.getIfAvailable()).thenReturn(dialogue);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"dialogue",dialogues);
        service.cancel("u","p",created.id(),new PlanExecutionControlRequest("stop-1",null));
        verify(dialogue).bindExecution("thread-1",null,null);
    }

    /** D01: after a newer plan revision exists, the older card (its own plan and fingerprint intact) starts nothing. */
    @Test void anOldCardCannotStartItsOldPlanOnceANewerRevisionExists() throws Exception {
        String old=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        String newer=planRun("IPR-new","analysis",ANALYSIS.replace("看结构","看结构，改成商品乙"),20,10);
        assertNotEquals(old,newer);
        cards.currentFingerprint=newer;cards.currentRunId="IPR-new";cards.currentRevision=4; // the thread moved on; the old card still says pending
        var stale=assertThrows(BusinessException.class,()->service.create("u","p",analysisRequest(old,30)));
        assertEquals("STUDIO_PLAN_STALE",stale.getCode());assertEquals(409,stale.getStatus().value());
        assertTrue(rows.isEmpty(),"no execution");assertTrue(cards.approved.isEmpty(),"the old card is not approved");verifyNoInteractions(executor);
        cards.put("msg-new","APV-new","analysis",newer,30,30);
        var wrongRevision=new PlanExecutionCreateRequest("create-rev","analysis","IPR-new",newer,null,30L,0L,null,null,3,"APV-new","msg-new");
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",wrongRevision)).getCode());
        var current=new PlanExecutionCreateRequest("create-new","analysis","IPR-new",newer,null,30L,0L,null,null,4,"APV-new","msg-new");
        assertEquals("running",service.create("u","p",current).status(),"the current revision's card works");
    }

    /** D02: a stage confirmation without the card the user confirmed is refused, never silently allowed. */
    @Test void aConfirmationWithoutItsCardIsRefusedAndNothingStarts() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var noCard=new PlanExecutionCreateRequest("create-x","analysis","IPR-a",fp,null,30L,0L,null,null,null,null,null);
        var noMessage=new PlanExecutionCreateRequest("create-y","analysis","IPR-a",fp,null,30L,0L,null,null,null,"APV-IPR-a",null);
        var noApproval=new PlanExecutionCreateRequest("create-z","analysis","IPR-a",fp,null,30L,0L,null,null,null,null,"msg-IPR-a");
        for(var req:List.of(noCard,noMessage,noApproval)) {
            var e=assertThrows(BusinessException.class,()->service.create("u","p",req));
            assertEquals("STUDIO_INPUT_INVALID",e.getCode());assertEquals(400,e.getStatus().value());
        }
        @SuppressWarnings("unchecked") ObjectProvider<StudioDialogueApprovals> none=mock(ObjectProvider.class);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"approvals",none);
        assertEquals("STUDIO_EXECUTION_UNAVAILABLE",assertThrows(BusinessException.class,()->service.create("u","p",analysisRequest(fp,30))).getCode(),
                "no card store: nothing can be confirmed");
        assertTrue(rows.isEmpty());verifyNoInteractions(executor);
    }

    /** D09: a forged / non-card confirmation message is 404, a non-current card 409; never 400. */
    @Test void aForgedConfirmationMessageIsNotFound() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var forged=new PlanExecutionCreateRequest("create-f","analysis","IPR-a",fp,null,30L,0L,null,null,null,"APV-IPR-a","IDM-user-message");
        var e=assertThrows(BusinessException.class,()->service.create("u","p",forged));
        assertEquals("STUDIO_APPROVAL_NOT_FOUND",e.getCode());assertEquals(404,e.getStatus().value());
    }

    /** D10: the card keeps what the user approved (cap 280 of a proposed 1000), the revision and the confirmation source. */
    @Test void theCardRecordsTheApprovedSnapshotNotTheProposal() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        cards.cards.get("msg-IPR-a|APV-IPR-a").put("budgetCap",1000);
        var created=service.create("u","p",new PlanExecutionCreateRequest("create-s","analysis","IPR-a",fp,null,280L,5L,null,null,null,"APV-IPR-a","msg-IPR-a"));
        assertEquals(1,cards.approved.size());
        var snapshot=cards.approved.get(0);
        assertEquals(280,snapshot.budgetCap());assertEquals(5,snapshot.autoFixCap());assertEquals(created.id(),snapshot.executionId());
        assertEquals("analysis",snapshot.stage());assertEquals(3,snapshot.planRevision());assertEquals("msg-IPR-a",snapshot.approvedByMessageId());
        assertNotNull(snapshot.at());
        assertEquals(280,created.budgets().get(0).approvedCap());assertEquals(3,created.planRevision());
    }

    /** D04: an approval in words goes through the same confirmation, bound to the user's own message. */
    @Test void anApprovalInWordsUsesTheCardPathAndOnlyTheNumbersTheUserSaid() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        cards.cards.get("msg-IPR-a|APV-IPR-a").put("budgetCap",200);
        cards.userTexts.put("IDM-ask","这个方案要多少钱？");
        var asked=assertThrows(BusinessException.class,()->service.confirmNatural("u","p",
                new com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate.NaturalApproval("APV-IPR-a","IDM-ask",null,null,"nl-1")));
        assertEquals("STUDIO_APPROVAL_AMBIGUOUS",asked.getCode(),"a question never approves");
        cards.userTexts.put("IDM-ok","就按这个分析开始，我确认");
        var above=assertThrows(BusinessException.class,()->service.confirmNatural("u","p",
                new com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate.NaturalApproval("APV-IPR-a","IDM-ok",500L,null,"nl-2")));
        assertEquals("STUDIO_INPUT_INVALID",above.getCode(),"a cap above the card needs the user's own number");
        assertTrue(rows.isEmpty());
        cards.userTexts.put("IDM-raise","可以，上限 280 积分，开始吧");
        var created=service.confirmNatural("u","p",new com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate.NaturalApproval("APV-IPR-a","IDM-raise",280L,null,"nl-3"));
        assertEquals("running",created.status());assertEquals(280,created.budgets().get(0).approvedCap());
        assertEquals("IDM-raise",cards.approved.get(0).approvedByMessageId(),"the user's message is the confirmation source");
        var budget=om.readTree(rows.get(created.id()).getBudgetJson()).path("analysis");
        assertEquals("IDM-raise",budget.path("confirmationMessageId").asText());assertEquals("APV-IPR-a",budget.path("approvalId").asText());
        assertEquals(created.id(),service.confirmNatural("u","p",new com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate.NaturalApproval("APV-IPR-a","IDM-raise",280L,null,"nl-3")).id(),
                "the same approval replays");
        verify(executor).wake(created.id());
    }

    /** D03: a stage confirmation or an explicit continue supersedes steering sent before it; queued ones still get a reply. */
    @Test void resumeMarksEarlierSteeringHandledAndOpensItsReply() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        var steering=mock(com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering.class);
        when(steering.notes("thread-1",created.id())).thenReturn(List.of(new com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering.Note("IDS-1","IDM-1","第二步不要做","queued",Instant.now())));
        @SuppressWarnings("unchecked") ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioExecutionSteering> provider=mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(steering);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"steering",provider);
        rows.get(created.id()).setStatus("needs_user");
        service.resume("u","p",created.id(),new PlanExecutionControlRequest("r-1",null));
        assertEquals("[\"IDS-1\"]",om.readTree(rows.get(created.id()).getStepsJson()).path("steeringSeen").toString());
        verify(steering).openTurn("thread-1");
    }

    // Codex retest 2026-10-19 (R3): after steering used the last credits, resume answered 402 and no raise card ever
    // appeared. Resume now hands the over-budget step to the executor, which stops there and posts the card.
    @Test void resumeOverBudgetGoesToTheExecutorForARaiseCardAndAcceptNeverRewritesTheVerdict() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        var row=rows.get(created.id());
        var state=(ObjectNode)om.readTree(row.getStepsJson());((ObjectNode)state.path("steps").get(0)).put("status","needs_user").put("reason","预算不够");
        row.setStepsJson(state.toString());row.setStatus("needs_user");
        var budget=(ObjectNode)om.readTree(row.getBudgetJson());((ObjectNode)budget.path("analysis")).put("spent",15);row.setBudgetJson(budget.toString());
        var overBudget=service.resume("u","p",created.id(),new PlanExecutionControlRequest("r-1",null));
        assertEquals("running",overBudget.status(),"not refused: the executor stops at the step and posts the raise card");
        assertEquals("pending",overBudget.steps().get(0).status());
        verify(executor,atLeastOnce()).wake(created.id());
        row.setStatus("needs_user"); // what the executor leaves behind, with its card on the thread
        cards.put("msg-3","APV-raise","analysis",fp,10,40);
        var raised=new PlanExecutionCreateRequest("raise-1","analysis","IPR-a",fp,null,40L,0L,null,created.id(),null,"APV-raise","msg-3");
        assertEquals(40,service.create("u","p",raised).budgets().get(0).approvedCap());
        var resumed=service.resume("u","p",created.id(),new PlanExecutionControlRequest("r-2",null));
        assertEquals("running",resumed.status());assertEquals("pending",resumed.steps().get(0).status());
        assertEquals("running",service.resume("u","p",created.id(),new PlanExecutionControlRequest("r-2",null)).status(),"same control id replays");
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.pause("u","p",created.id(),new PlanExecutionControlRequest("r-2",null))).getCode());
        assertEquals("paused",service.pause("u","p",created.id(),new PlanExecutionControlRequest("p-1",null)).status());

        state=(ObjectNode)om.readTree(rows.get(created.id()).getStepsJson());
        var step=(ObjectNode)state.path("steps").get(0);step.put("status","done").put("checkStatus","fail");step.putArray("runIds").add("IPR-run");
        rows.get(created.id()).setStepsJson(state.toString());
        assertThrows(BusinessException.class,()->service.accept("u","p",created.id(),"cut",new PlanExecutionAcceptRequest("a-1","IPR-elsewhere",null)));
        var done=new IpRunDto("IPR-run","p","n","studio-recreation","done","done",100,10,null,null,om.createObjectNode(),om.createObjectNode(),Instant.now().toString(),null,null);
        when(outputs.run("u","p","IPR-run")).thenReturn(Optional.of(done));
        var accepted=service.accept("u","p",created.id(),"cut",new PlanExecutionAcceptRequest("a-2","IPR-run",null));
        assertEquals("IPR-run",accepted.steps().get(0).acceptedRunId());
        assertEquals("fail",om.readTree(rows.get(created.id()).getStepsJson()).path("steps").get(0).path("checkStatus").asText(),"the AI verdict is kept");
        assertEquals("canceled",service.cancel("u","p",created.id(),new PlanExecutionControlRequest("x-1",null)).status());
    }

    /** An execution in its production stage: analysis done, the production plan IPR-b (v1 40 + check c1 5) confirmed. */
    String production() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        var row=rows.get(created.id());var state=(ObjectNode)om.readTree(row.getStepsJson());
        state.path("steps").forEach(s->((ObjectNode)s).put("status","done"));row.setStepsJson(state.toString());row.setStatus("needs_user");
        String pf=currentPlan("IPR-b","production",PRODUCTION,40,5);
        service.create("u","p",new PlanExecutionCreateRequest("c-prod","production","IPR-b",pf,"rewrite",45L,0L,null,created.id(),3,"APV-IPR-b","msg-IPR-b"));
        return created.id();
    }
    /** Mark a step of the execution with a status (and a run), like the executor would. */
    void step(String id,String stepId,String status,String run) throws Exception {
        var row=rows.get(id);var state=(ObjectNode)om.readTree(row.getStepsJson());
        for(JsonNode raw:state.path("steps"))if(stepId.equals(raw.path("id").asText())&&"production".equals(raw.path("stage").asText())) {
            ((ObjectNode)raw).put("status",status);if(run!=null)((ObjectNode)raw).withArray("runIds").add(run);
        }
        row.setStepsJson(state.toString());
    }
    JsonNode stepNode(String id,String stepId) throws Exception {
        for(JsonNode raw:om.readTree(rows.get(id).getStepsJson()).path("steps"))
            if(stepId.equals(raw.path("id").asText())&&"production".equals(raw.path("stage").asText()))return raw;
        return null;
    }
    static final String V2=",{\"id\":\"v2\",\"operation\":\"video\",\"title\":\"第二段\",\"prompt\":\"收尾\",\"settings\":{\"video\":{\"mode\":\"omni\",\"resolutionTier\":\"768p\"},\"durationSec\":8,\"aspectRatio\":\"9:16\",\"count\":1,"
            +"\"referenceBindings\":[{\"nodeId\":\"product\",\"role\":\"product\",\"order\":0}]}}";
    static String withV2(String plan){return plan.replace("]}},{\"id\":\"c1\"","]}}"+V2+",{\"id\":\"c1\"");}

    /**
     * Codex 2026-10-19 (P1): 「第 3 段换个人物」 paused the execution, the dialogue proposed a revised production plan, and
     * confirming its card was refused as 「同阶段不能换计划」. Now the revision replaces the remaining work on the same
     * execution: unchanged finished steps keep their results, a new step is added, nothing already done is paid twice.
     */
    @Test void aRevisedPlanForTheRunningStageKeepsUnchangedResultsAndAddsTheNewSteps() throws Exception {
        String id=production();
        step(id,"v1","done","IPR-v1");step(id,"c1","done","IPR-c1");
        var row=rows.get(id);row.setStatus("needs_user");
        var budget=(ObjectNode)om.readTree(row.getBudgetJson());((ObjectNode)budget.path("production")).put("spent",45);row.setBudgetJson(budget.toString());
        String revised=currentPlan("IPR-c","production",withV2(PRODUCTION),40,30,5);
        cards.put("msg-rev","APV-rev","production",revised,75,80);
        var confirmed=service.create("u","p",new PlanExecutionCreateRequest("c-rev","production","IPR-c",revised,"rewrite",80L,0L,null,id,3,"APV-rev","msg-rev"));
        assertEquals(id,confirmed.id(),"same execution, same payer");
        assertEquals("running",confirmed.status());assertEquals("IPR-c",confirmed.planRunId());
        assertEquals("done",stepNode(id,"v1").path("status").asText(),"unchanged and finished: kept, not run again");
        assertEquals("[\"IPR-v1\"]",stepNode(id,"v1").path("runIds").toString());
        assertEquals("pending",stepNode(id,"v2").path("status").asText());
        assertEquals("done",stepNode(id,"c1").path("status").asText());
        assertEquals(80,confirmed.budgets().get(1).approvedCap());assertEquals(45,confirmed.budgets().get(1).spent(),"what was spent stays spent");
        assertTrue(cards.approvedCards.contains("msg-rev|APV-rev"));
        verify(executor,atLeastOnce()).wake(id);
        assertEquals(id,service.create("u","p",new PlanExecutionCreateRequest("c-rev","production","IPR-c",revised,"rewrite",80L,0L,null,id,3,"APV-rev","msg-rev")).id(),
                "the same confirmation replays");
    }

    /** A changed step is redone as a new attempt (earlier run kept for the record and the budget), and so is its check. */
    @Test void aRevisedPlanRedoesTheChangedStepAndEverythingDownstreamOfIt() throws Exception {
        String id=production();
        step(id,"v1","done","IPR-v1");step(id,"c1","done","IPR-c1");
        var row=rows.get(id);row.setStatus("needs_user");
        var budget=(ObjectNode)om.readTree(row.getBudgetJson());((ObjectNode)budget.path("production")).put("spent",45);row.setBudgetJson(budget.toString());
        String revised=currentPlan("IPR-c","production",PRODUCTION.replace("开播","开播，主播换成短发女生"),40,5);
        var tooLow=new PlanExecutionCreateRequest("c-low","production","IPR-c",revised,"rewrite",45L,0L,null,id,3,"APV-IPR-c","msg-IPR-c");
        var refused=assertThrows(BusinessException.class,()->service.create("u","p",tooLow));
        assertEquals("STUDIO_PLAN_BUDGET_EXCEEDED",refused.getCode(),"45 spent + 45 to redo does not fit 45");
        assertEquals(45,((JsonNode)refused.getDetails()).path("shortfall").asLong());
        assertEquals("needs_user",rows.get(id).getStatus(),"a refused revision changes nothing");
        cards.put("msg-more","APV-more","production",revised,45,90);
        var confirmed=service.create("u","p",new PlanExecutionCreateRequest("c-more","production","IPR-c",revised,"rewrite",90L,0L,null,id,3,"APV-more","msg-more"));
        assertEquals("running",confirmed.status());
        var v1=stepNode(id,"v1");
        assertEquals("pending",v1.path("status").asText());assertEquals(2,v1.path("attempt").asInt(),"a new request identity");
        assertEquals("[\"IPR-v1\"]",v1.path("previousRunIds").toString());assertEquals(0,v1.path("runIds").size());
        assertTrue(v1.path("definition").path("prompt").asText().contains("短发女生"));
        assertEquals("pending",stepNode(id,"c1").path("status").asText(),"the check of a redone video runs again");
        assertEquals("[\"IPR-c1\"]",stepNode(id,"c1").path("previousRunIds").toString());
    }

    /** Work already handed to a provider is never rewritten: changing a step that is still generating waits for it. */
    @Test void aRevisionCannotChangeAStepThatIsStillGenerating() throws Exception {
        String id=production();
        step(id,"v1","running","IPR-v1");
        String revised=currentPlan("IPR-c","production",PRODUCTION.replace("开播","开播，换个人物"),40,5);
        cards.put("msg-more","APV-more","production",revised,45,200);
        var e=assertThrows(BusinessException.class,()->service.create("u","p",new PlanExecutionCreateRequest("c-run","production","IPR-c",revised,"rewrite",200L,0L,null,id,3,"APV-more","msg-more")));
        assertEquals("STUDIO_PLAN_STALE",e.getCode());assertTrue(e.getMessage().contains("还在生成中"));
        assertEquals("IPR-b",rows.get(id).getPlanRunId(),"nothing changed");
    }

    /**
     * Codex 2026-10-19 (P2): the raise card says 「确认把上限提高到 X 积分后，我接着做」, but confirming it only moved the cap;
     * the execution stayed needs_user until the user clicked 「继续」 too. A raise now releases the steps stopped for budget.
     */
    @Test void aRaiseTheExecutorAskedForContinuesWithoutAnotherClick() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        var row=rows.get(created.id());
        var state=(ObjectNode)om.readTree(row.getStepsJson());
        ((ObjectNode)state.path("steps").get(0)).put("status","needs_user").put("reason","本阶段预算还差 5 积分").put("budgetBlocked",true);
        state.put("needsUserReason","预算不够");row.setStepsJson(state.toString());row.setStatus("needs_user");
        var budget=(ObjectNode)om.readTree(row.getBudgetJson());((ObjectNode)budget.path("analysis")).put("spent",15).put("shortfall",5);row.setBudgetJson(budget.toString());
        cards.put("msg-raise","APV-raise","analysis",fp,30,35);
        var raised=service.create("u","p",new PlanExecutionCreateRequest("raise-1","analysis","IPR-a",fp,null,35L,0L,null,created.id(),null,"APV-raise","msg-raise"));
        assertEquals("running",raised.status());assertEquals("pending",raised.steps().get(0).status());assertNull(raised.needsUserReason());
        assertEquals(35,raised.budgets().get(0).approvedCap());assertNull(raised.budgets().get(0).shortfall());
        assertFalse(om.readTree(rows.get(created.id()).getStepsJson()).path("steps").get(0).has("budgetBlocked"));
    }

    /** A raise never overrides the user's own pause, and never unblocks a step that waits for something else. */
    @Test void aRaiseLeavesAPauseAndOtherWaitsAlone() throws Exception {
        String fp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        var row=rows.get(created.id());
        var state=(ObjectNode)om.readTree(row.getStepsJson());
        ((ObjectNode)state.path("steps").get(0)).put("status","needs_user").put("reason","「拉片」需要你确认后再继续");
        row.setStepsJson(state.toString());row.setStatus("needs_user");
        cards.put("msg-raise","APV-raise","analysis",fp,30,40);
        var raised=service.create("u","p",new PlanExecutionCreateRequest("raise-1","analysis","IPR-a",fp,null,40L,0L,null,created.id(),null,"APV-raise","msg-raise"));
        assertEquals("needs_user",raised.status(),"not a budget stop");assertEquals("needs_user",raised.steps().get(0).status());
        state=(ObjectNode)om.readTree(rows.get(created.id()).getStepsJson());
        ((ObjectNode)state.path("steps").get(0)).put("reason","本阶段预算还差 5 积分").put("budgetBlocked",true);
        rows.get(created.id()).setStepsJson(state.toString());rows.get(created.id()).setStatus("paused");
        cards.put("msg-raise2","APV-raise2","analysis",fp,30,50);
        var paused=service.create("u","p",new PlanExecutionCreateRequest("raise-2","analysis","IPR-a",fp,null,50L,0L,null,created.id(),null,"APV-raise2","msg-raise2"));
        assertEquals("paused",paused.status(),"the user's pause stays");assertEquals("pending",paused.steps().get(0).status(),"its 「继续制作」 will go on");
    }


    /** 意图直达 2026-10-20: a direct skill (出图) starts its execution from its one production card; recreation still cannot. */
    @Test void aDirectSkillsProductionCardStartsTheExecutionInProduction() throws Exception {
        StudioSkillRules.Rules image;
        StudioSkill imageSkill;
        try(var in=getClass().getResourceAsStream("/studio/skills/image-generation.md")){imageSkill=StudioSkillCatalog.parse(new String(in.readAllBytes(),StandardCharsets.UTF_8));}
        image=StudioSkillRules.rules(imageSkill);
        // The live catalog is where creation re-checks the skill is still active (requireActive), so it must know this one too.
        when(catalog.requireForNewWork("image-generation")).thenReturn(imageSkill);when(catalog.find("image-generation")).thenReturn(Optional.of(imageSkill));
        String raw="{\"summary\":\"一张海报\",\"steps\":[{\"id\":\"poster\",\"operation\":\"image\",\"title\":\"海报\",\"prompt\":\"竖版海报\",\"settings\":{\"count\":1,\"referenceBindings\":[]}}],\"questions\":[]}";
        var plan=StudioPlanValidator.validateSkillPlan(om.readTree(raw),image,"production",List.of("product"));
        plan.put("skillKey",image.key()).put("skillVersion",image.version()).put("stage","production").put("revision",1);
        ((ObjectNode)plan.path("steps").get(0)).put("quotedCost",8);
        plan.putObject("budget").put("estimated",8).put("autoFixCap",0);
        String fp=StudioPlanValidator.fingerprint(plan);plan.put("fingerprint",fp);
        var output=om.createObjectNode();output.set("plan",plan);
        var input=om.createObjectNode();input.putArray("contextNodeIds").add("product");input.putObject("dialogue").put("threadId","thread-1").put("messageId","m");
        input.putObject("_exec").set("skill",StudioSkillRules.snapshot(image));
        runs.put("IPR-img",IpRun.builder().id("IPR-img").projectId("p").ownerUserId("u").kind("studio-dialogue").status("done").inputJson(input.toString()).outputJson(output.toString()).build());
        cards.currentFingerprint=fp;cards.currentRunId="IPR-img";
        cards.put("msg-IPR-img","APV-IPR-img","production",fp,8,20);
        var req=new PlanExecutionCreateRequest("create-img","production","IPR-img",fp,null,20L,0L,null,null,null,"APV-IPR-img","msg-IPR-img");
        var created=service.create("u","p",req);
        assertEquals("running",created.status());
        assertEquals("production",created.stage(),"no analysis stage was ever created");
        assertEquals(1,created.steps().size());
        assertEquals("production",created.steps().get(0).stage());
        assertEquals(created.id()+"-p-poster",created.steps().get(0).nodeId());
        assertEquals(List.of("production"),created.budgets().stream().map(b->b.stage()).toList());
        assertEquals(20,created.budgets().get(0).approvedCap());
        verify(executor).wake(created.id());
        assertEquals(created.id(),service.create("u","p",req).id(),"same request replays");
        // The non-direct method keeps its order: a production request with no execution is still refused before anything.
        rows.clear();cards.approved.clear();
        String analysisFp=currentPlan("IPR-a","analysis",ANALYSIS,20,10);
        var production=new PlanExecutionCreateRequest("create-4b","production","IPR-a",analysisFp,null,30L,0L,null,null,null,"APV-IPR-a","msg-IPR-a");
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->service.create("u","p",production)).getCode());
    }

    /** §6.1: the direct skill's one step fills the draft the assistant made in this conversation, named or not. */
    @Test void aConfirmedStepFillsTheObjectTheAssistantPreparedForIt() throws Exception {
        StudioSkill imageSkill;
        try(var in=getClass().getResourceAsStream("/studio/skills/image-generation.md")){imageSkill=StudioSkillCatalog.parse(new String(in.readAllBytes(),StandardCharsets.UTF_8));}
        var image=StudioSkillRules.rules(imageSkill);
        when(catalog.requireForNewWork("image-generation")).thenReturn(imageSkill);when(catalog.find("image-generation")).thenReturn(Optional.of(imageSkill));
        when(projects.readDoc(any())).thenReturn(om.readTree("{\"nodes\":[{\"id\":\"dlg-img\",\"type\":\"image\",\"title\":\"海报\",\"metadata\":{\"prompt\":\"竖版海报\"}},"
                +"{\"id\":\"product\",\"type\":\"image\",\"title\":\"商品\",\"metadata\":{\"storageKey\":\"ipstudio_source/u/p.png\"}}],\"connections\":[]}"));
        extraSources.add(new StudioPlanSource() {
            @Override public Optional<PlanRecord> find(String userId,String projectId,String planRunId,String fingerprint){return Optional.empty();}
            @Override public Set<String> assistantNodeIds(String threadId){return "thread-1".equals(threadId)?Set.of("dlg-img"):Set.of();}
        });
        String raw="{\"summary\":\"一张海报\",\"steps\":[{\"id\":\"poster\",\"operation\":\"image\",\"title\":\"海报\",\"prompt\":\"竖版海报\",\"settings\":{\"count\":1,\"referenceBindings\":[]}}],\"questions\":[]}";
        var plan=StudioPlanValidator.validateSkillPlan(om.readTree(raw),image,"production",List.of("product","dlg-img"));
        plan.put("skillKey",image.key()).put("skillVersion",image.version()).put("stage","production").put("revision",1);
        ((ObjectNode)plan.path("steps").get(0)).put("quotedCost",8);
        plan.putObject("budget").put("estimated",8).put("autoFixCap",0);
        String fp=StudioPlanValidator.fingerprint(plan);plan.put("fingerprint",fp);
        var output=om.createObjectNode();output.set("plan",plan);
        var input=om.createObjectNode();input.putArray("contextNodeIds").add("product");input.putObject("dialogue").put("threadId","thread-1").put("messageId","m");
        input.putObject("_exec").set("skill",StudioSkillRules.snapshot(image));
        runs.put("IPR-img",IpRun.builder().id("IPR-img").projectId("p").ownerUserId("u").kind("studio-dialogue").status("done").inputJson(input.toString()).outputJson(output.toString()).build());
        cards.currentFingerprint=fp;cards.currentRunId="IPR-img";
        cards.put("msg-IPR-img","APV-IPR-img","production",fp,8,20);
        var created=service.create("u","p",new PlanExecutionCreateRequest("create-bind","production","IPR-img",fp,null,20L,0L,null,null,null,"APV-IPR-img","msg-IPR-img"));
        assertEquals("dlg-img",created.steps().get(0).nodeId(),"the step fills the assistant's draft, not a node of its own");
        assertEquals("dlg-img",om.readTree(rows.get(created.id()).getStepsJson()).path("steps").get(0).path("nodeId").asText(),"stored for the run, the projection and the restore");
    }

    // ── 原创创作: a production-only skill (IPP-51a92043, 2026-10-20) ─────────────────────────────────────────────────
    static final String ORIGINAL_IMAGES="{\"summary\":\"三视图\",\"recommendedApproachId\":\"sheet\",\"approaches\":[{\"id\":\"sheet\",\"title\":\"三张视角图\",\"summary\":\"正侧背各一张\",\"rationale\":\"用户要三视图\"}],"
            +"\"steps\":[{\"id\":\"front\",\"operation\":\"image\",\"title\":\"正面\",\"prompt\":\"原创女性角色正面全身\",\"settings\":{\"count\":1}},"
            +"{\"id\":\"side\",\"operation\":\"image\",\"title\":\"侧面\",\"prompt\":\"同一角色侧面全身\",\"settings\":{\"count\":1,\"referenceBindings\":[{\"stepId\":\"front\",\"role\":\"character\",\"order\":0}]},\"dependsOn\":[\"front\"]},"
            +"{\"id\":\"back\",\"operation\":\"image\",\"title\":\"背面\",\"prompt\":\"同一角色背面全身\",\"settings\":{\"count\":1,\"referenceBindings\":[{\"stepId\":\"front\",\"role\":\"character\",\"order\":0}]},\"dependsOn\":[\"front\"]}],\"questions\":[]}";

    @Test void aProductionOnlySkillStartsItsExecutionInProductionWithTheConfirmedQuoteAndApproach() throws Exception {
        rules=StudioSkillRules.rules(originalSkill);
        assertEquals("production",rules.firstStage());
        String fp=currentPlan("IPR-o","production",ORIGINAL_IMAGES,30,30,30);
        var created=service.create("u","p",new PlanExecutionCreateRequest("orig-1","production","IPR-o",fp,"sheet",90L,0L,null,null,3,"APV-IPR-o","msg-IPR-o"));
        assertEquals("running",created.status());assertEquals("production",created.stage());assertEquals("original-creation",created.skillKey());
        assertEquals(3,created.steps().size());assertEquals(90,created.budgets().get(0).approvedCap());assertEquals("production",created.budgets().get(0).stage());
        verify(executor).wake(created.id());
        // replay is idempotent; a wrong approach and a cap under the quote are refused like any confirmation
        assertEquals(created.id(),service.create("u","p",new PlanExecutionCreateRequest("orig-1","production","IPR-o",fp,"sheet",90L,0L,null,null,3,"APV-IPR-o","msg-IPR-o")).id());
    }

    @Test void aProductionOnlyPlanNeedsTheRecommendedApproachAndTheQuoteWithinTheCap() throws Exception {
        rules=StudioSkillRules.rules(originalSkill);
        String fp=currentPlan("IPR-o","production",ORIGINAL_IMAGES,30,30,30);
        assertThrows(BusinessException.class,()->service.create("u","p",new PlanExecutionCreateRequest("orig-x","production","IPR-o",fp,"other",90L,0L,null,null,3,"APV-IPR-o","msg-IPR-o")));
        var low=assertThrows(BusinessException.class,()->service.create("u","p",new PlanExecutionCreateRequest("orig-y","production","IPR-o",fp,"sheet",60L,0L,null,null,3,"APV-IPR-o","msg-IPR-o")));
        assertNotEquals("STUDIO_INPUT_INVALID",low.getCode(),"the budget guard, not the stage order, refuses it");
        assertTrue(rows.isEmpty(),"nothing started");
    }

    @Test void theReferenceVideoSkillStillCannotStartInProduction() throws Exception {
        String fp=currentPlan("IPR-p","production",PRODUCTION,40,5);
        var e=assertThrows(BusinessException.class,()->service.create("u","p",new PlanExecutionCreateRequest("prod-0","production","IPR-p",fp,"rewrite",45L,0L,null,null,3,"APV-IPR-p","msg-IPR-p")));
        assertEquals("STUDIO_INPUT_INVALID",e.getCode());
        assertTrue(rows.isEmpty());
    }

    @Test void aProductionOnlyCardConfirmedInWordsStartsTheExecution() throws Exception {
        rules=StudioSkillRules.rules(originalSkill);
        currentPlan("IPR-o","production",ORIGINAL_IMAGES,30,30,30);
        cards.userTexts.put("IDM-ok","可以，按这个出图");
        var created=service.confirmNatural("u","p",new com.aistareco.aep.ipstudio.dialogue.StudioExecutionGate.NaturalApproval("APV-IPR-o","IDM-ok",null,null,"nl-o"));
        assertEquals("production",created.stage());assertEquals("running",created.status());
    }
}
