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
import com.fasterxml.jackson.databind.node.ObjectNode;
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
    private com.aistareco.aep.service.materialvideo.MaterialVideoJobService videoJobs;
    private com.aistareco.aep.service.AiModelInvocationService aiModels;

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

        videoJobs = mock(com.aistareco.aep.service.materialvideo.MaterialVideoJobService.class);
        aiModels = mock(com.aistareco.aep.service.AiModelInvocationService.class);
        // 默认：任何端点 id 都在白名单里（不关心端点的用例不必逐个 stub）。
        // ResolvedEndpoint 是 record，mock 不了，给个真实例。
        when(aiModels.resolveEndpoint(org.mockito.ArgumentMatchers.any(), anyString()))
                .thenReturn(java.util.Optional.of(
                        new com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint(
                                null, null, true)));
        svc = new IpRunService(runs.repo, projectService, catalog, IpStudioFixtures.props(),
                prompts, multimodal, pricing, accounts, credits, worker, OM, videoJobs, aiModels);
    }

    private PromptService.ResolvedPrompt resourcePrompt(String key) {
        String user = PromptService.KEY_DAP_IP_IDENTITY.equals(key)
                ? "请输出人物特征卡 JSON。"
                : "{{refLead}}{{refOrder}}{{prompt}} {{refNotes}}no text.";
        return new PromptService.ResolvedPrompt("你是 IP 形象设定师。", user, new PromptParamsDto(null, null, null), "resource");
    }

    private void seedProject(IpStudioFixtures.Doc doc) {
        projects.repo.save(IpStudioFixtures.project(PID, USER, doc));
    }

    // ── 输入编译 ─────────────────────────────────────────────

    @Test
    void generate_withoutPrompt_is400AndHoldsNothing() {
        // 画布通用化之后，一个图节点唯一的必填就是「要画什么」。
        IpStudioFixtures.Doc d = new IpStudioFixtures.Doc();
        d.imageNode("n-source", IpStudioFixtures.sourceKey(USER, "p.jpg"));
        d.node("n-gen", "image").put("count", 1);
        d.edge("n-source", "n-gen");
        seedProject(d);

        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.run(USER, PID, "n-gen", null));
        assertEquals(HttpStatus.BAD_REQUEST, e.getStatus());
        assertEquals("IP_NODE_INPUT_MISSING", e.getCode());
        @SuppressWarnings("unchecked")
        List<String> missing = (List<String>) ((java.util.Map<String, Object>) e.getDetails()).get("missing");
        assertTrue(missing.contains("prompt"), "应报缺提示词：" + missing);
        // 缺输入的时候一分钱都不能冻
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void nonRunnableNode_is400_andUnknownNodeIs404() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        d.node("n-note", "text").put("content", "这是一张便签");
        seedProject(d);
        // 文字节点不产出媒体，跑它没有意义
        assertEquals("IP_NODE_NOT_RUNNABLE",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-note", null)).getCode());
        assertEquals("IP_NODE_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "nope", null)).getCode());
    }

    @Test
    void otherOwnerCannotRun() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        assertEquals("IP_PROJECT_NOT_FOUND",
                assertThrows(BusinessException.class, () -> svc.run(OTHER, PID, "n-gen", null)).getCode());
    }

    // ── 形象卡通用化（v0.153）：自由 prompt 与老五字段 ──────────

    @Test
    void promptActuallyReachesTheModelPrompt() {
        // 最容易踩空的地方：编译时「有没有提示词」的校验和「真正拼给模型的那段」是两处代码。
        // 一旦不同步，用户能点运行、服务端不报缺内容，但出的图跟他写的毫无关系 —— 而且不会有任何报错。
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        d.data("n-gen").put("prompt", "米色粗针织毛衫配浅色直筒牛仔裤，低头看手机，嘴角微扬");
        seedProject(d);

        String prompt = svc.run(USER, PID, "n-gen", null).inputs().path("prompt").asText();
        assertTrue(prompt.contains("米色粗针织毛衫配浅色直筒牛仔裤，低头看手机，嘴角微扬"),
                "用户写的提示词必须原样进入模型提示词：" + prompt);
        assertFalse(prompt.contains("{{"), "模板占位符必须全部替换掉：" + prompt);
    }

    // ── 画布出视频 ────────────────────────────────────────

    @Test
    void videoGoesThroughTheGeneralVideoLane_notTheAvatarDerivativeOne() {
        // 关键：画布上的人往往还没发布，没有 avatarId。dap 的衍生视频那条要求先有形象，
        // 所以这里必须走通用视频链，并且显式带 ipstudio 分区 —— 不带就会跟带货 / 短剧串号。
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        com.fasterxml.jackson.databind.node.ObjectNode card = OM.createObjectNode();
        card.put("id", "MVJ-1").put("status", "rendering");
        when(videoJobs.submit(org.mockito.ArgumentMatchers.any(), eq(USER),
                eq(com.aistareco.aep.service.materialvideo.MaterialVideoJobService.APP_IPSTUDIO)))
                .thenReturn(List.of(card));

        JsonNode got = svc.generateVideo(USER, PID,
                new IpRunService.IpVideoRequest("让它挥手", null, 4, "9:16", null));

        assertEquals("MVJ-1", got.path("id").asText());
        org.mockito.ArgumentCaptor<JsonNode> body = org.mockito.ArgumentCaptor.forClass(JsonNode.class);
        verify(videoJobs).submit(body.capture(), eq(USER),
                eq(com.aistareco.aep.service.materialvideo.MaterialVideoJobService.APP_IPSTUDIO));
        JsonNode item = body.getValue().path("items").get(0);
        assertEquals("让它挥手", item.path("prompt").asText());
        assertEquals(4, item.path("duration_sec").asInt());
        assertEquals("9:16", item.path("aspect_ratio").asText());
    }

    @Test
    void videoFirstFrameKeyIsGuarded() {
        // 首帧图同样是画布传来的 key —— 不过闸就能拿别人的图当首帧出片
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        assertEquals("IP_ASSET_KEY_INVALID", assertThrows(BusinessException.class,
                () -> svc.generateVideo(USER, PID, new IpRunService.IpVideoRequest(
                        "偷图出片", IpStudioFixtures.genKey(OTHER, "victim.png"), 4, null, null))).getCode());
        verify(videoJobs, never()).submit(org.mockito.ArgumentMatchers.any(), anyString(), anyString());
    }

    @Test
    void videoWithoutPromptIs400() {
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        assertEquals("IP_NODE_INPUT_MISSING", assertThrows(BusinessException.class,
                () -> svc.generateVideo(USER, PID, new IpRunService.IpVideoRequest("", null, null, null, null))).getCode());
        verify(videoJobs, never()).submit(org.mockito.ArgumentMatchers.any(), anyString(), anyString());
    }

    // ── 参考图：上游图按远近排序、有上限 ───────────────────────

    @Test
    void referencesComeFromUpstreamImages_nearestFirst_andAreCapped() {
        // 参考图 = 连进来的上游图。近的排前面（用户刚接上的那张最相关），
        // 超过上限就砍尾 —— 一条长链上所有历史产物都喂进去只会把模型拖花。
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc("ipstudio_gen/" + USER + "/master.png", 4);
        seedProject(d);

        IpRunDto dto = svc.run(USER, PID, "n-gen", null);
        JsonNode refs = dto.inputs().path("refs");
        assertEquals(IpStudioFixtures.props().getMaxRefImages(), refs.size(), "超过上限要砍掉，不能全喂进去");
        for (JsonNode r : refs) assertTrue(r.path("applied").asBoolean(), "留下的都得是生效的：" + r);

        String prompt = dto.inputs().path("prompt").asText();
        // 「照着参考图里的人」必须排在用户那段描述**之前**（v0.171）：
        // 排在后面时模型会照着那段完整的角色描述画，而不是照着上传的照片画。
        // 多张参考图 = 用户在做合成，不该替他加「保持所有参考图里的人不变」——
        // 那跟「用图1的脸 + 图2的形态」直接矛盾（v0.173）。取而代之给出编号，
        // 让他提示词里的「图1 / 图2」有确定指代。
        assertFalse(prompt.contains("Keep the same person"),
                "多参考图时不该注入身份指令：" + prompt);
        assertTrue(prompt.contains("image 1 = 图1"), "没给出参考图编号：" + prompt);
        assertFalse(prompt.contains("{{"), "模板占位符必须全部替换掉：" + prompt);

        // _exec 是服务端执行参数（含 storage key），绝不出 wire
        assertTrue(dto.inputs().path("_exec").isMissingNode());
    }

    @Test
    void runWithoutAnyUpstreamImageStillWorks() {
        // 一张白纸上写一句话直接出图 —— 这是画布最基本的用法，不能要求必须先连点什么
        IpStudioFixtures.Doc d = new IpStudioFixtures.Doc();
        d.node("n-solo", "image").put("prompt", "一只戴墨镜的柴犬，3D 潮玩风格");
        seedProject(d);

        IpRunDto dto = svc.run(USER, PID, "n-solo", null);
        assertEquals(0, dto.inputs().path("refs").size());
        assertTrue(dto.inputs().path("prompt").asText().contains("戴墨镜的柴犬"));
    }

    @Test
    void assetKeyOfAnotherUser_is400_andHoldsNothing() {
        // 把别人的照片 key 抄进自己的画布 = 拿别人的脸出图
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        d.data("n-source").put("storageKey", IpStudioFixtures.sourceKey(OTHER, "victim.jpg"));
        seedProject(d);

        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null));
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
        d.data("n-source").put("storageKey", "ipstudio_source/" + USER + "/../../../../etc/passwd");
        seedProject(d);

        assertEquals("IP_ASSET_KEY_INVALID",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null)).getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void absoluteAssetKey_is400() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 0);
        d.data("n-source").put("storageKey", "/etc/hosts");
        seedProject(d);

        assertEquals("IP_ASSET_KEY_INVALID",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null)).getCode());
    }

    @Test
    void referenceNodeAssetKeyIsGuardedToo() {
        IpStudioFixtures.Doc d = IpStudioFixtures.chainDoc(null, 1);
        d.data("n-ref-1").put("storageKey", IpStudioFixtures.sourceKey(OTHER, "stolen.png"));
        seedProject(d);

        assertEquals("IP_ASSET_KEY_INVALID",
                assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null)).getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void engineNotConfigured_is503AndHoldsNothing() {
        when(multimodal.imageModel()).thenReturn(null);
        seedProject(IpStudioFixtures.chainDoc(null, 0));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, e.getStatus());
        assertEquals("DAP_ENGINE_NOT_CONFIGURED", e.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
        verify(worker, never()).execute(anyString());
        assertTrue(runs.rows.isEmpty(), "503 时不该留下运行记录");
    }

    @Test
    void promptNotConfigured_is503AndHoldsNothing() {
        when(prompts.resolve(anyString())).thenReturn(new PromptService.ResolvedPrompt(
                "sys", "{{input}}", new PromptParamsDto(null, null, null), "code"));
        seedProject(IpStudioFixtures.chainDoc(null, 0));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.run(USER, PID, "n-gen", null));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, e.getStatus());
        assertEquals("PROMPT_NOT_CONFIGURED", e.getCode());
        verify(credits, never()).hold(anyString(), anyLong(), anyString(), anyString(), anyString());
    }

    @Test
    void dispatchWaitsForTransactionCommitWhenOneIsActive() {
        // 真联调踩到的坑：@Transactional 里直接派发，worker 在 commit 前 findById 为空 → 任务永远 queued。
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        TransactionSynchronizationManager.initSynchronization();
        try {
            IpRunDto dto = svc.run(USER, PID, "n-gen", null);
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
        IpRunDto dto = svc.run(USER, PID, "n-gen", null);

        // 2 张 × 8 = 16 一次性冻结，referenceId 就是 runId
        verify(credits).hold(USER, 16L, IpRunService.REF_TYPE, dto.id(), "画布出图 ×2");
        verify(worker).execute(dto.id());
        assertEquals(IpRun.STATUS_RUNNING, dto.status());
        assertEquals(16L, dto.cost());
        assertTrue(dto.id().startsWith("IPR-"), dto.id());
    }

    @Test
    void holdSnapshotsUnitPriceForTheWorker() {
        // worker 结算时只认这份快照 —— 后台在 hold 与 commit 之间改价不该影响这一单
        seedProject(IpStudioFixtures.chainDoc(null, 0));
        IpRunDto dto = svc.run(USER, PID, "n-gen", null);
        JsonNode exec = IpStudioFixtures.OM.createObjectNode();
        try {
            exec = IpStudioFixtures.OM.readTree(runs.rows.get(dto.id()).getInputJson()).path("_exec");
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        assertEquals(8L, exec.path("unitCost").asLong());
        assertEquals(16L, exec.path("holdTotal").asLong());
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
