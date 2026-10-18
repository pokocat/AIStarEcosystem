package com.aistareco.aep.ipstudio.execution;

import com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioPlanDtos.*;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioPlanValidator;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
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
        var catalog=mock(StudioSkillCatalog.class);var skill=StudioSkillCatalog.parse(file);
        when(catalog.requireForNewWork("reference-video-recreation")).thenReturn(skill);when(catalog.find("reference-video-recreation")).thenReturn(Optional.of(skill));
        @SuppressWarnings("unchecked") ObjectProvider<StudioSkillCatalog> catalogs=mock(ObjectProvider.class);when(catalogs.getIfAvailable()).thenReturn(catalog);
        var skills=new StudioSkillRules(catalogs);rules=StudioSkillRules.rules(skill);
        outputs=mock(StudioPlanOutputs.class);executor=mock(StudioPlanExecutor.class);
        @SuppressWarnings("unchecked") ObjectProvider<StudioPlanExecutor> executors=mock(ObjectProvider.class);when(executors.getIfAvailable()).thenReturn(executor);
        @SuppressWarnings("unchecked") ObjectProvider<StudioPlanSource> sources=mock(ObjectProvider.class);when(sources.orderedStream()).thenAnswer(i->Stream.empty());
        service=new StudioPlanExecutionService(executions,projects,skills,outputs,executors,sources,om);
    }

    /** A native planning run with a normalized, quoted, fingerprinted plan. */
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
        return new PlanExecutionCreateRequest("create-1","analysis","IPR-a",fingerprint,null,cap,0L,null,null,null,"APV-1","msg-1");
    }

    @Test void analysisExecutionIsCreatedOnceWithAnImmutablePayerAndWokenAfterCommit() throws Exception {
        String fp=planRun("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        assertEquals("running",created.status());assertEquals("analysis",created.stage());assertEquals("thread-1",created.threadId());
        assertEquals(2,created.steps().size());assertEquals("pending",created.steps().get(0).status());
        assertEquals(created.id()+"-a-cut",created.steps().get(0).nodeId());
        assertEquals("personal",created.billing().mode());assertEquals(30,created.budgets().get(0).approvedCap());
        verify(executor).wake(created.id());
        assertEquals(created.id(),service.create("u","p",analysisRequest(fp,30)).id(),"same request replays");
        assertEquals("STUDIO_REQUEST_CHANGED",assertThrows(BusinessException.class,()->service.create("u","p",analysisRequest(fp,31))).getCode());
        var other=new PlanExecutionCreateRequest("create-2","analysis","IPR-a",fp,null,30L,0L,null,null,null,null,null);
        assertEquals("STUDIO_PLAN_EXECUTION_BUSY",assertThrows(BusinessException.class,()->service.create("u","p",other)).getCode());
    }

    @Test void quotesAboveTheCapAndStalePlansAreRefusedBeforeAnything() throws Exception {
        String fp=planRun("IPR-a","analysis",ANALYSIS,20,10);
        var over=assertThrows(BusinessException.class,()->service.create("u","p",analysisRequest(fp,29)));
        assertEquals("STUDIO_PLAN_BUDGET_EXCEEDED",over.getCode());assertEquals(402,over.getStatus().value());
        var details=(JsonNode)over.getDetails();
        assertEquals(1,details.path("shortfall").asLong());assertEquals(30,details.path("quotedCost").asLong());assertEquals(29,details.path("approvedCap").asLong());
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",analysisRequest("forged",30))).getCode());
        var foreign=new PlanExecutionCreateRequest("create-3","analysis","IPR-not-mine",fp,null,30L,0L,null,null,null,null,null);
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",foreign)).getCode());
        var production=new PlanExecutionCreateRequest("create-4","production","IPR-a",fp,null,30L,0L,null,null,null,null,null);
        assertEquals("STUDIO_INPUT_INVALID",assertThrows(BusinessException.class,()->service.create("u","p",production)).getCode(),"production is confirmed on the analysis execution");
        assertTrue(rows.isEmpty());verifyNoInteractions(executor);
    }

    @Test void productionIsConfirmedOnTheSameExecutionOnlyForTheConfirmedApproachAndRevision() throws Exception {
        String fp=planRun("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        String pf=planRun("IPR-b","production",PRODUCTION,40,5);
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
        String fp=planRun("IPR-a","analysis",ANALYSIS,20,10);
        var run=runs.get("IPR-a");run.setKind("studio-dialogue");
        var cards=mock(com.aistareco.aep.ipstudio.dialogue.StudioDialogueApprovals.class);
        var card=om.createObjectNode().put("type","approval").put("approvalId","APV-1").put("stage","analysis").put("planFingerprint",fp)
                .put("quotedCost",30).put("budgetCap",30).put("threadId","thread-1").put("messageId","msg-1");
        card.putObject("billingSelection").put("mode","personal");
        when(cards.requireApproval("u","p","msg-1","APV-1")).thenReturn(card);
        @SuppressWarnings("unchecked") ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioDialogueApprovals> provider=mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(cards);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"approvals",provider);
        var stale=card.deepCopy().put("planFingerprint","an-older-plan");
        when(cards.requireApproval("u","p","msg-old","APV-1")).thenReturn(stale);
        var old=new PlanExecutionCreateRequest("create-old","analysis","IPR-a",fp,null,30L,0L,null,null,null,"APV-1","msg-old");
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",old)).getCode(),"an old card never approves a new revision");
        var repriced=card.deepCopy().put("quotedCost",25).put("messageId","msg-cheap");
        when(cards.requireApproval("u","p","msg-cheap","APV-1")).thenReturn(repriced);
        var cheap=new PlanExecutionCreateRequest("create-cheap","analysis","IPR-a",fp,null,30L,0L,null,null,null,"APV-1","msg-cheap");
        assertEquals("STUDIO_PLAN_STALE",assertThrows(BusinessException.class,()->service.create("u","p",cheap)).getCode(),"the card must show the current quote");
        verify(cards,never()).markApproved(any(),any(),any(),any(),any(),any());
        var created=service.create("u","p",analysisRequest(fp,30));
        assertEquals("thread-1",created.threadId());
        verify(cards).markApproved("u","p","msg-1","APV-1",created.id(),"analysis");
        var dialogue=mock(com.aistareco.aep.ipstudio.dialogue.StudioDialogueService.class);
        @SuppressWarnings("unchecked") ObjectProvider<com.aistareco.aep.ipstudio.dialogue.StudioDialogueService> dialogues=mock(ObjectProvider.class);
        when(dialogues.getIfAvailable()).thenReturn(dialogue);
        org.springframework.test.util.ReflectionTestUtils.setField(service,"dialogue",dialogues);
        service.cancel("u","p",created.id(),new PlanExecutionControlRequest("stop-1",null));
        verify(dialogue).bindExecution("thread-1",null,null);
    }

    @Test void resumeChecksTheNextStepBudgetAndAcceptNeverRewritesTheVerdict() throws Exception {
        String fp=planRun("IPR-a","analysis",ANALYSIS,20,10);
        var created=service.create("u","p",analysisRequest(fp,30));
        var row=rows.get(created.id());
        var state=(ObjectNode)om.readTree(row.getStepsJson());((ObjectNode)state.path("steps").get(0)).put("status","needs_user").put("reason","预算不够");
        row.setStepsJson(state.toString());row.setStatus("needs_user");
        var budget=(ObjectNode)om.readTree(row.getBudgetJson());((ObjectNode)budget.path("analysis")).put("spent",15);row.setBudgetJson(budget.toString());
        var refused=assertThrows(BusinessException.class,()->service.resume("u","p",created.id(),new PlanExecutionControlRequest("r-1",null)));
        assertEquals("STUDIO_PLAN_BUDGET_EXCEEDED",refused.getCode());assertEquals(5,((JsonNode)refused.getDetails()).path("shortfall").asLong());
        assertEquals("needs_user",rows.get(created.id()).getStatus(),"refused resume changes nothing");
        var raised=new PlanExecutionCreateRequest("raise-1","analysis","IPR-a",fp,null,40L,0L,null,created.id(),null,null,"msg-3");
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
}
