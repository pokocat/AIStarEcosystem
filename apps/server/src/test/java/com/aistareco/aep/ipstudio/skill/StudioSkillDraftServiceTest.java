package com.aistareco.aep.ipstudio.skill;

import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.enterprise.service.EnterpriseBillingService;
import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.DraftRequest;
import com.aistareco.aep.ipstudio.execution.IpPlanExecution;
import com.aistareco.aep.ipstudio.execution.IpPlanExecutionRepository;
import com.aistareco.aep.ipstudio.execution.StudioPlanSource;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioFixtureProvider;
import com.aistareco.aep.ipstudio.service.StudioWorkflowWorker;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Distill acceptance: operator only, finished executions only, priced and held before dispatch, no private material in the prompt. */
class StudioSkillDraftServiceTest {
    final ObjectMapper om = new ObjectMapper();
    final IpProjectService projects = mock(IpProjectService.class);
    final IpRunRepository runs = mock(IpRunRepository.class);
    final IpPlanExecutionRepository executions = mock(IpPlanExecutionRepository.class);
    final IpSkillRepository skillRows = mock(IpSkillRepository.class);
    final IpSkillVersionRepository versionRows = mock(IpSkillVersionRepository.class);
    final StudioSkillStore store = mock(StudioSkillStore.class);
    final PromptService prompts = mock(PromptService.class);
    final AiModelInvocationService models = mock(AiModelInvocationService.class);
    final CreditService credits = mock(CreditService.class);
    final StudioFixtureProvider fixtures = mock(StudioFixtureProvider.class);
    final StudioWorkflowWorker worker = mock(StudioWorkflowWorker.class);
    final AiChatTokenPricing tokenPricing = mock(AiChatTokenPricing.class);
    final PlatformTransactionManager manager = mock(PlatformTransactionManager.class);
    StudioSkillDraftService service;
    IpPlanExecution execution;

    @SuppressWarnings("unchecked")
    static <T> ObjectProvider<T> provider(T value) {
        ObjectProvider<T> p = mock(ObjectProvider.class);
        when(p.getIfAvailable()).thenReturn(value);
        when(p.orderedStream()).thenAnswer(i -> value == null ? Stream.empty() : Stream.of(value));
        return p;
    }

    @BeforeEach void setUp() throws Exception {
        when(manager.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        when(store.skills()).thenReturn(skillRows);
        when(store.versions()).thenReturn(versionRows);
        when(projects.requiredForUpdate("op", "P1")).thenReturn(IpProject.builder().id("P1").ownerUserId("op").build());
        when(projects.toRunDto(any())).thenAnswer(i -> new com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto(((IpRun) i.getArgument(0)).getId(), "P1",
                ((IpRun) i.getArgument(0)).getNodeId(), "studio-text", "running", "queued", 0, ((IpRun) i.getArgument(0)).getCost(), null, null, om.createObjectNode(), om.createObjectNode(), null, null, null));
        String body = StudioSkillCatalog.parse(Files.readString(Path.of("src/main/resources/studio/skills/reference-video-recreation.md"))).body();
        when(skillRows.findById("reference-video-recreation")).thenReturn(Optional.of(IpSkill.builder().skillKey("reference-video-recreation")
                .name("参考视频复刻").status("active").currentVersion(2).build()));
        when(versionRows.findBySkillKeyAndVersion("reference-video-recreation", 2)).thenReturn(Optional.of(IpSkillVersion.builder()
                .skillKey("reference-video-recreation").version(2).bodyMd(body).frontmatterJson("{}").build()));
        var endpoint = AiModelEndpoint.builder().id("ep-text").name("文本").model("m").enabled(true).build();
        when(models.resolveAcceptedEndpoint(any(), isNull(), eq("studio"))).thenReturn(Optional.of(new AiModelInvocationService.ResolvedEndpoint(endpoint, null, true)));
        when(prompts.resolve(PromptService.KEY_DAP_IP_STUDIO_SKILL_DISTILL)).thenReturn(new PromptService.ResolvedPrompt("编辑",
                "{{skillName}} v{{baseVersion}}/{{executionVersion}}\n{{skill}}\n{{execution}}\n{{note}}", new PromptParamsDto(null, null, null), "resource"));
        when(tokenPricing.find("ep-text")).thenReturn(new AiChatTokenPricing.Rate(BigDecimal.ONE, BigDecimal.ONE, 32000, 8000));

        // A finished execution whose steps carry a private prompt and a storage key that must never reach the model.
        var state = om.createObjectNode();
        var steps = state.putArray("steps");
        ObjectNode video = steps.addObject().put("id", "v1").put("stage", "production").put("operation", "video").put("title", "第一段")
                .put("status", "done").put("attempt", 2).put("acceptedRunId", "IPR-accepted");
        video.putArray("runIds").add("IPR-a").add("IPR-b");
        video.putObject("definition").put("prompt", "SECRET-PROMPT 把我的蓝色保温杯放在左手").putObject("settings").putObject("video").put("firstFrameKey", "ipstudio_gen/op/secret.png");
        video.withObject("/definition").putObject("strategy").put("approachId", "rewrite").put("method", "creative-rewrite").put("reason", "换了商品所以重写动作");
        ObjectNode check = steps.addObject().put("id", "chk").put("stage", "production").put("operation", "check").put("title", "检查").put("status", "done")
                .put("checkStatus", "fail");
        check.putArray("runIds").add("IPR-check");
        var checkRun = om.createObjectNode();
        checkRun.putObject("check").putArray("items").addObject().put("id", "character-consistency").put("status", "fail").put("reason", "第二段人物发型与第一段不同，像换了人");
        when(projects.ownedRun("op", "P1", "IPR-check")).thenReturn(Optional.of(IpRun.builder().id("IPR-check").status("done").outputJson(checkRun.toString()).build()));
        var budget = om.createObjectNode();
        budget.putObject("production").put("approvedCap", 300).put("spent", 240).put("planRunId", "IPR-plan").put("planFingerprint", "fp").put("approachId", "rewrite");
        var plan = om.createObjectNode().put("summary", "保留首播骨架，换成新商品重新拍四段").put("recommendedApproachId", "rewrite");
        plan.putArray("approaches").addObject().put("id", "rewrite").put("title", "改写剧情").put("summary", "保留首播骨架与反转，重写动作和对白")
                .put("rationale", "新商品与原片道具差别大，照搬动作会穿帮");
        StudioPlanSource source = (u, p, run, fp) -> Optional.of(new StudioPlanSource.PlanRecord(run, plan, null, List.of(), 1, null, null));
        when(projects.ownedRun("op", "P1", "IPR-plan")).thenReturn(Optional.of(IpRun.builder().id("IPR-plan").status("done").outputJson("{}").build()));
        execution = IpPlanExecution.builder().id("PEX-1").projectId("P1").ownerUserId("op").skillKey("reference-video-recreation").skillVersion(1)
                .stage("production").status("done").stepsJson(state.toString()).budgetJson(budget.toString()).billingJson("{}")
                .startedAt(Instant.now().minusSeconds(1800)).finishedAt(Instant.now()).build();
        when(executions.findById("PEX-1")).thenAnswer(i -> Optional.of(execution));

        ObjectProvider<AiAppSceneModelPolicyService> scenes = provider(null);
        ObjectProvider<EnterpriseBillingService> enterprise = provider(null);
        service = new StudioSkillDraftService(projects, runs, executions, store, prompts, models, mock(DapPricingService.class), credits, fixtures, worker,
                scenes, provider(tokenPricing), enterprise, provider(source), om, manager);
        TransactionSynchronizationManager.initSynchronization();
    }

    @AfterEach void clear() { if (TransactionSynchronizationManager.isSynchronizationActive()) TransactionSynchronizationManager.clearSynchronization(); }

    DraftRequest request(Long maxCost) { return new DraftRequest("draft-1", "PEX-1", "看人物一致性", maxCost, null); }

    @Test void onlyOperatorsCanDistill() {
        var e = assertThrows(BusinessException.class, () -> service.submit("op", "P1", request(500L), false));
        assertEquals("STUDIO_SKILL_DRAFT_FORBIDDEN", e.getCode());
        assertEquals(403, e.getStatus().value());
        verifyNoInteractions(credits, runs, executions);
    }

    @Test void theExecutionMustBelongToTheCanvasAndBeFinished() {
        execution.setStatus("running");
        assertEquals("STUDIO_SKILL_DRAFT_NOT_READY", assertThrows(BusinessException.class, () -> service.submit("op", "P1", request(500L), true)).getCode());
        execution.setStatus("partial");
        execution.setProjectId("OTHER");
        assertEquals("STUDIO_PLAN_EXECUTION_NOT_FOUND", assertThrows(BusinessException.class, () -> service.submit("op", "P1", request(500L), true)).getCode());
        execution.setProjectId("P1");
        when(fixtures.enabled()).thenReturn(true);
        assertEquals("STUDIO_SKILL_DRAFT_UNAVAILABLE", assertThrows(BusinessException.class, () -> service.submit("op", "P1", request(500L), true)).getCode());
        verifyNoInteractions(credits);
        verify(runs, never()).save(any());
    }

    @Test void priceIsCheckedBeforeAnythingIsHeld() {
        assertEquals("STUDIO_PRICE_CHANGED", assertThrows(BusinessException.class, () -> service.submit("op", "P1", request(null), true)).getCode());
        when(tokenPricing.find("ep-text")).thenReturn(null);
        assertEquals("AI_TOKEN_PRICE_NOT_CONFIGURED", assertThrows(BusinessException.class, () -> service.submit("op", "P1", request(500L), true)).getCode());
        verifyNoInteractions(credits);
        verify(runs, never()).save(any());
    }

    @Test void acceptedRunIsHeldDispatchedAfterCommitAndCarriesNoPrivateMaterial() {
        long cost = new AiChatTokenPricing.Rate(BigDecimal.ONE, BigDecimal.ONE, 32000, 8000).maxCost();
        var dto = service.submit("op", "P1", request(cost), true);
        var saved = ArgumentCaptor.forClass(IpRun.class);
        verify(runs).save(saved.capture());
        IpRun run = saved.getValue();
        assertEquals(dto.id(), run.getId());
        assertEquals("studio-text", run.getKind());
        assertEquals("SKD-PEX-1", run.getNodeId());
        verify(credits).hold("op", cost, "ip-run", run.getId(), "Studio 整理制作方法");
        var input = parse(run.getInputJson());
        assertEquals("skill-distill", input.path("purpose").asText());
        var distill = input.path("_exec").path("skillDistill");
        assertEquals(2, distill.path("baseVersion").asInt(), "drafts revise the current version");
        assertEquals("PEX-1", distill.path("executionId").asText());
        String prompt = input.path("_exec").path("userPrompt").asText();
        assertTrue(prompt.contains("character-consistency") && prompt.contains("creative-rewrite"), "check verdicts and methods reach the model");
        assertTrue(prompt.contains("\"adopted\":true") && prompt.contains("\"attempts\":2"));
        assertFalse(prompt.contains("SECRET-PROMPT"), "step prompts never reach the model");
        assertFalse(prompt.contains("ipstudio_gen/"), "storage keys never reach the model");
        List<String> fragments = new ArrayList<>();
        distill.path("privateFragments").forEach(f -> fragments.add(f.asText()));
        assertTrue(fragments.contains("第二段人物发型与第一段不同，像换了人"), "case text is remembered so a verbatim copy can be stripped");
        verify(worker, never()).execute(anyString());
        TransactionSynchronizationManager.getSynchronizations().forEach(TransactionSynchronization::afterCommit);
        verify(worker).execute(run.getId());

        // Replay of the same request returns the same run; a changed body is refused.
        when(runs.findByProjectIdAndClientRequestId("P1", "draft-1")).thenReturn(Optional.of(run));
        assertEquals(run.getId(), service.submit("op", "P1", request(cost), true).id());
        var changed = new DraftRequest("draft-1", "PEX-1", "换个重点", cost, null);
        assertEquals("STUDIO_REQUEST_CHANGED", assertThrows(BusinessException.class, () -> service.submit("op", "P1", changed, true)).getCode());
        verify(credits, times(1)).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    private com.fasterxml.jackson.databind.JsonNode parse(String json) {
        try { return om.readTree(json); } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
