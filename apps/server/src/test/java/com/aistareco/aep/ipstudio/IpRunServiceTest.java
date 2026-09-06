package com.aistareco.aep.ipstudio;

import com.aistareco.aep.dap.service.DapAccountService;
import com.aistareco.aep.dap.service.DapMultimodalClient;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.dto.PromptParamsDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.IpRunWorker;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.OTHER;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.USER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 输入编译 / preflight / 冻结 的服务层契约（ip-studio-plan §4.3 + §7）。
 *
 * <p>重点守两条不可退让的红线：
 * ① preflight（引擎 / 提示词）**一定在 hold 之前** —— 未配置就 503，不冻结一分钱；
 * ② 参考图超上限时按 master → source → reference 砍尾并**如实回报**，不静默丢弃。
 */
class IpRunServiceTest {

    private static final String PID = "IPP-11111111";

    private IpStudioFixtures.Projects projects;
    private IpStudioFixtures.Runs runs;
    private FileStorageService storage;
    private PromptService prompts;
    private DapMultimodalClient multimodal;
    private DapPricingService pricing;
    private DapAccountService accounts;
    private CreditService credits;
    private IpRunWorker worker;
    private IpProjectService projectService;
    private IpRunService svc;

    @BeforeEach
    void setUp() {
        projects = new IpStudioFixtures.Projects();
        runs = new IpStudioFixtures.Runs();
        storage = IpStudioFixtures.storage();
        IpCatalogService catalog = new IpCatalogService(OM);
        projectService = new IpProjectService(projects.repo, runs.repo, catalog, storage,
                IpStudioFixtures.props(), OM);

        prompts = mock(PromptService.class);
        when(prompts.resolve(anyString())).thenAnswer(inv -> resourcePrompt(inv.getArgument(0, String.class)));

        multimodal = mock(DapMultimodalClient.class);
        when(multimodal.chatModel()).thenReturn("vision-model");
        when(multimodal.imageModel()).thenReturn("image-model");

        pricing = mock(DapPricingService.class);
        when(pricing.ipIdentity()).thenReturn(2L);
        when(pricing.ipImage()).thenReturn(8L);

        accounts = mock(DapAccountService.class);
        credits = mock(CreditService.class);
        worker = mock(IpRunWorker.class);

        svc = new IpRunService(runs.repo, projectService, catalog, IpStudioFixtures.props(),
                prompts, multimodal, pricing, accounts, credits, worker, OM);
    }

    private PromptService.ResolvedPrompt resourcePrompt(String key) {
        String user = PromptService.KEY_DAP_IP_IDENTITY.equals(key)
                ? "请输出人物特征卡 JSON。"
                : "{{style}} identity: {{identity}} {{outfit}} {{pose}} {{expression}} "
                  + "{{details}} {{props}} {{refNotes}} avoid: {{negative}} no text.";
        return new PromptService.ResolvedPrompt("你是 IP 形象设定师。", user, new PromptParamsDto(null, null, null), "resource");
    }

    private void seedProject(IpStudioFixtures.Doc doc) {
        projects.repo.save(IpStudioFixtures.project(PID, USER, doc));
    }

    // ── 输入编译 ─────────────────────────────────────────────

    @Test
    void generate_missingIdentityAndStyle_is400WithMissingDetails() {
        IpStudioFixtures.Doc d = new IpStudioFixtures.Doc();
        d.node("n-source", "source").put("assetKey", IpStudioFixtures.sourceKey(USER, "p.jpg"));
        var look = d.node("n-look", "look");
        look.put("title", "造型").put("outfit", "白衬衫");
        d.node("n-gen", "generate").put("count", 1).put("isMaster", false);
        d.edge("n-source", "n-look").edge("n-look", "n-gen");
        seedProject(d);

        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.run(USER, PID, "n-gen", null));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals("IP_NODE_INPUT_MISSING", e.getCode());
        @SuppressWarnings("unchecked")
        List<String> missing = (List<String>) ((java.util.Map<String, Object>) e.getDetails()).get("missing");
        assertTrue(missing.contains("identity"), "应报缺人物特征卡：" + missing);
        assertTrue(missing.contains("style"), "应报缺风格：" + missing);
        // 缺输入的时候一分钱都不能冻
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void identity_withoutSourcePhoto_is400() {
        IpStudioFixtures.Doc d = new IpStudioFixtures.Doc();
        d.node("n-identity", "identity").put("text", "").put("promptEn", "").put("locked", false);
        seedProject(d);

        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.run(USER, PID, "n-identity", null));
        assertEquals("IP_NODE_INPUT_MISSING", e.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void nonRunnableNode_is400_andUnknownNodeIs404() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        assertEquals("IP_NODE_NOT_RUNNABLE",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-style", null)).getCode());
        assertEquals("IP_NODE_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "nope", null)).getCode());
    }

    @Test
    void otherOwnerCannotRun() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        assertEquals("IP_PROJECT_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.run(OTHER, PID, "n-gen", null)).getCode());
    }

    // ── 参考图顺序与砍尾回报 ─────────────────────────────────

    @Test
    void generate_referenceOrderIsMasterThenSourceThenReferences_andOverflowIsReported() {
        String masterRunId = "IPR-master01";
        // 4 张局部参考 + master + source = 6 个候选，上限 4 → 末两张 reference 被砍
        seedProject(IpStudioFixtures.chainDoc(masterRunId, 4));
        runs.repo.save(IpStudioFixtures.doneGenerateRun(masterRunId, PID, "n-master", 4));

        IpRunDto dto = svc.run(USER, PID, "n-gen", null);
        JsonNode refs = dto.inputs().path("refs");
        assertEquals(6, refs.size());
        assertEquals("master", refs.get(0).path("role").asText());
        assertEquals("source", refs.get(1).path("role").asText());
        assertEquals("reference", refs.get(2).path("role").asText());
        assertTrue(refs.get(0).path("applied").asBoolean());
        assertTrue(refs.get(3).path("applied").asBoolean());
        assertFalse(refs.get(4).path("applied").asBoolean());
        assertEquals("over_max_refs", refs.get(4).path("reason").asText());
        assertFalse(refs.get(5).path("applied").asBoolean());

        // 提示词是服务端拼的，用户看得到原文；风格 / 身份 / 形象卡四栏 / 参考图说明都在里面
        String prompt = dto.inputs().path("prompt").asText();
        assertTrue(prompt.contains("3D rendered BJD doll figure"), prompt);
        assertTrue(prompt.contains("consistent facial identity"), prompt);
        assertTrue(prompt.contains("米白色针织冷帽"), prompt);
        assertTrue(prompt.contains("Reference image 1: hat style only 1"), prompt);
        assertTrue(prompt.contains("no photorealistic skin"), prompt);
        assertFalse(prompt.contains("{{"), "模板占位符必须全部替换掉：" + prompt);

        // _exec 是服务端执行参数（含 storage key），绝不出 wire
        assertTrue(dto.inputs().path("_exec").isMissingNode());
    }

    @Test
    void masterNodeRunsWithoutLook_andWithoutAnyReference() {
        // 主形象节点上游没有 look（模板 §6 就是这么排的），也还没有选中候选 → 无图参考也允许运行
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        IpRunDto dto = svc.run(USER, PID, "n-master", null);
        assertEquals(IpRun.KIND_GENERATE, dto.kind());
        assertEquals(4, dto.inputs().path("count").asInt());
        // 主形象没有 master 参考，但仍会带上原照片
        JsonNode refs = dto.inputs().path("refs");
        assertEquals(1, refs.size());
        assertEquals("source", refs.get(0).path("role").asText());
    }

    // ── 资产 key 归属闸（doc 是客户端写的，key 一律不可信）───

    @Test
    void assetKeyOfAnotherUser_is400_andHoldsNothing() {
        // 把别人的照片 key 抄进自己的画布 = 拿别人的脸出图
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        ((com.fasterxml.jackson.databind.node.ObjectNode) d.root.path("nodes").get(0).path("data"))
                .put("assetKey", IpStudioFixtures.sourceKey(OTHER, "victim.jpg"));
        seedProject(d);

        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-master", null));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals("IP_ASSET_KEY_INVALID", e.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        assertTrue(runs.rows.isEmpty(), "越权 key 不该留下运行记录");
    }

    @Test
    void traversalAssetKey_is400() {
        // FileStorageService.openForRead 是 Paths.get(localDir, key) 直接拼路径，
        // 放进来一个 ../ 就能把本机任意文件当参考图 base64 上行给外部模型
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        ((com.fasterxml.jackson.databind.node.ObjectNode) d.root.path("nodes").get(0).path("data"))
                .put("assetKey", "ipstudio_source/" + USER + "/../../../../etc/passwd");
        seedProject(d);

        assertEquals("IP_ASSET_KEY_INVALID",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-master", null)).getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void absoluteAssetKey_is400() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        ((com.fasterxml.jackson.databind.node.ObjectNode) d.root.path("nodes").get(0).path("data"))
                .put("assetKey", "/etc/hosts");
        seedProject(d);

        assertEquals("IP_ASSET_KEY_INVALID",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-master", null)).getCode());
    }

    @Test
    void referenceNodeAssetKeyIsGuardedToo() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 1);
        for (com.fasterxml.jackson.databind.JsonNode n : d.root.path("nodes")) {
            if ("n-ref-1".equals(n.path("id").asText())) {
                ((com.fasterxml.jackson.databind.node.ObjectNode) n.path("data"))
                        .put("assetKey", IpStudioFixtures.sourceKey(OTHER, "stolen.png"));
            }
        }
        seedProject(d);

        assertEquals("IP_ASSET_KEY_INVALID",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null)).getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void selectedRunFromAnotherProject_isRejectedNotSilentlyIgnored() {
        // 静默忽略 = 「没选主图」→ 照价出一张没有身份锚的图，用户还以为锁了脸
        String foreignRunId = "IPR-foreign1";
        seedProject(IpStudioFixtures.chainDoc(foreignRunId, 0));
        IpRun foreign = IpStudioFixtures.doneGenerateRun(foreignRunId, "IPP-99999999", "n-master", 4);
        runs.repo.save(foreign);

        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null));
        assertEquals("IP_RUN_NOT_FOUND", e.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void selectedRunOfAnotherOwner_isRejected() {
        String foreignRunId = "IPR-foreign2";
        seedProject(IpStudioFixtures.chainDoc(foreignRunId, 0));
        IpRun foreign = IpStudioFixtures.doneGenerateRun(foreignRunId, PID, "n-master", 4);
        foreign.setOwnerUserId(OTHER);
        runs.repo.save(foreign);

        assertEquals("IP_RUN_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null)).getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void ownMasterRunStillWorks_andItsCandidateBecomesTheIdentityAnchor() {
        String masterRunId = "IPR-mine0001";
        seedProject(IpStudioFixtures.chainDoc(masterRunId, 0));
        runs.repo.save(IpStudioFixtures.doneGenerateRun(masterRunId, PID, "n-master", 4));

        IpRunDto dto = svc.run(USER, PID, "n-gen", null);
        JsonNode refs = dto.inputs().path("refs");
        assertEquals("master", refs.get(0).path("role").asText());
        assertTrue(refs.get(0).path("applied").asBoolean());
        verify(credits).hold(USER, 16L, IpRunService.REF_TYPE, dto.id(), "IP 形象卡出图 ×2");
    }

    // ── preflight（§8.0）─────────────────────────────────────

    @Test
    void engineNotConfigured_is503AndHoldsNothing() {
        when(multimodal.imageModel()).thenReturn(null);
        seedProject(IpStudioFixtures.chainDoc(null, 0));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-master", null));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, e.getStatus());
        assertEquals("DAP_ENGINE_NOT_CONFIGURED", e.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(worker, never()).execute(anyString());
        assertTrue(runs.rows.isEmpty(), "503 时不该留下运行记录");
    }

    @Test
    void visionEngineNotConfigured_blocksIdentityRun() {
        when(multimodal.chatModel()).thenReturn("  ");
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-identity", null));
        assertEquals("DAP_ENGINE_NOT_CONFIGURED", e.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void promptNotConfigured_is503AndHoldsNothing() {
        when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt(
                "sys", "{{input}}", new PromptParamsDto(null, null, null), "code"));
        seedProject(IpStudioFixtures.chainDoc(null, 0));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-master", null));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, e.getStatus());
        assertEquals("PROMPT_NOT_CONFIGURED", e.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    // ── 冻结与派发 ───────────────────────────────────────────

    @Test
    void dispatchWaitsForTransactionCommitWhenOneIsActive() {
        // 真联调踩到的坑：@Transactional 里直接派发，worker 在 commit 前 findById 为空 → 任务永远 queued。
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        TransactionSynchronizationManager.initSynchronization();
        try {
            IpRunDto dto = svc.run(USER, PID, "n-master", null);
            verify(worker, never()).execute(anyString());
            for (TransactionSynchronization sync : TransactionSynchronizationManager.getSynchronizations()) {
                sync.afterCommit();
            }
            verify(worker).execute(dto.id());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void holdsWholeBatchBeforeDispatch() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        IpRunDto dto = svc.run(USER, PID, "n-master", null);

        // 4 张 × 8 = 32 一次性冻结，referenceId 就是 runId
        verify(credits).hold(USER, 32L, IpRunService.REF_TYPE, dto.id(), "IP 主形象生成 ×4");
        verify(worker).execute(dto.id());
        assertEquals(IpRun.STATUS_RUNNING, dto.status());
        assertEquals(32L, dto.cost());
        assertTrue(dto.id().startsWith("IPR-"), dto.id());
    }

    @Test
    void holdSnapshotsUnitPriceForTheWorker() {
        // worker 结算时只认这份快照 —— 后台在 hold 与 commit 之间改价不该影响这一单
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        IpRunDto dto = svc.run(USER, PID, "n-master", null);
        JsonNode exec = IpStudioFixtures.OM.createObjectNode();
        try {
            exec = IpStudioFixtures.OM.readTree(runs.rows.get(dto.id()).getInputJson()).path("_exec");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        assertEquals(8L, exec.path("unitCost").asLong());
        assertEquals(32L, exec.path("holdTotal").asLong());
        // 快照是服务端执行参数，不出 wire
        assertTrue(dto.inputs().path("_exec").isMissingNode());
    }

    @Test
    void queueFullOnDispatch_failsTheRunAndReleasesTheHold() {
        // 线程池排满时 @Async 抛 TaskRejectedException：hold 已冻、run 已落库，
        // 不接住就是一个永远 running 的节点 + 三小时后才回来的冻结额
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        org.mockito.Mockito.doThrow(new org.springframework.core.task.TaskRejectedException("queue full"))
                .when(worker).execute(anyString());

        IpRunDto dto = svc.run(USER, PID, "n-master", null);

        verify(worker).abandon(eq(dto.id()), eq("IP_RUN_QUEUE_FULL"), anyString());
    }

    @Test
    void identityRunHoldsSingleUnit() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        IpRunDto dto = svc.run(USER, PID, "n-identity", null);
        verify(credits).hold(USER, 2L, IpRunService.REF_TYPE, dto.id(), "IP 人物特征卡抽取");
        assertEquals(IpRun.KIND_IDENTITY, dto.kind());
    }

    @Test
    void sameNodeAlreadyRunning_is409() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        svc.run(USER, PID, "n-master", null);
        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-master", null));
        assertEquals(HttpStatus.CONFLICT, e.getStatus());
        assertEquals("IP_RUN_ALREADY_RUNNING", e.getCode());
    }

    @Test
    void runRequestCanCarryLatestDoc() {
        // 项目里存的是一张空画布；运行请求顺手带上完整文档（防抖 PUT 还没落地的情形）
        projects.repo.save(IpProject.builder()
                .id(PID).ownerUserId(USER).name("空画布")
                .status(IpProject.STATUS_DRAFT)
                .docJson("{\"nodes\":[],\"edges\":[],\"viewport\":{\"x\":0,\"y\":0,\"zoom\":1}}")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build());

        IpRunDto dto = svc.run(USER, PID, "n-master",
                new com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpRunNodeRequest(
                        IpStudioFixtures.chainDoc(null, 0).root));
        assertEquals(IpRun.STATUS_RUNNING, dto.status());
        assertTrue(projects.rows.get(PID).getDocJson().contains("n-master"));
    }

    @Test
    void cancelOnlyMarksFlagAndLeavesTerminalStateToWorker() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        IpRunDto dto = svc.run(USER, PID, "n-master", null);
        IpRunDto cancelled = svc.cancel(USER, dto.id());
        assertEquals(IpRun.STATUS_RUNNING, cancelled.status(), "取消只置标记，终态由 worker 落");
        assertTrue(runs.rows.get(dto.id()).isCancelRequested());
    }

    @Test
    void runNotFoundForOtherOwner() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        IpRunDto dto = svc.run(USER, PID, "n-master", null);
        assertEquals("IP_RUN_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.get(OTHER, dto.id())).getCode());
    }
}
