package com.aistareco.aep.ipstudio;

import com.aistareco.aep.dap.service.DapImageInput;
import com.aistareco.aep.dap.service.DapMultimodalClient;
import com.aistareco.aep.dap.service.DapMultimodalClient.DapModelException;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.IpRunWorker;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.USER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 逐张出图的计费纪律（ip-studio-plan §4.3）。
 *
 * <p>守的是 {@code DramaReferenceAssetService} 那条血泪教训：**先 commit 再落产物**，
 * 首张失败即停并释放剩余，零成功一律 failed + 原始 errorCode（绝不产假产物）。
 */
class IpRunWorkerTest {

    private static final String PID = "IPP-22222222";
    private static final String RID = "IPR-abcdef01";

    private IpStudioFixtures.Runs runs;
    private DapMultimodalClient multimodal;
    private DapImageInput imageInput;
    private CreditService credits;
    private DapPricingService pricing;
    private FileStorageService storage;
    private IpRunWorker worker;

    @BeforeEach
    void setUp() {
        runs = new IpStudioFixtures.Runs();
        IpStudioFixtures.Projects projects = new IpStudioFixtures.Projects();
        storage = IpStudioFixtures.storage();
        IpProjectService projectService = new IpProjectService(projects.repo, runs.repo,
                new IpCatalogService(OM), storage, IpStudioFixtures.props(), OM);

        multimodal = mock(DapMultimodalClient.class);
        imageInput = mock(DapImageInput.class);
        when(imageInput.of(anyString())).thenAnswer(inv -> "https://cdn.test/" + inv.getArgument(0, String.class));
        credits = mock(CreditService.class);
        pricing = mock(DapPricingService.class);
        when(pricing.ipIdentity()).thenReturn(2L);
        when(pricing.ipImage()).thenReturn(8L);

        worker = new IpRunWorker(runs.repo, projectService, multimodal, imageInput, pricing,
                storage, credits, OM);
    }

    // ── 样本运行行 ───────────────────────────────────────────

    private IpRun seedGenerateRun(int count) {
        return seedGenerateRun(count, 8L, 8L * count, "source");
    }

    /**
     * @param unit      _exec 里的单价快照（hold 当时的价）
     * @param holdTotal _exec 里的冻结总额
     * @param roles     参考图角色，按顺序进 refKeys / refs
     */
    private IpRun seedGenerateRun(int count, long unit, long holdTotal, String... roles) {
        ObjectNode inputs = OM.createObjectNode();
        inputs.put("prompt", "a compiled english prompt");
        inputs.put("size", "768x1024");
        inputs.put("count", count);
        ArrayNode refs = inputs.putArray("refs");
        ObjectNode exec = inputs.putObject("_exec");
        ArrayNode keys = exec.putArray("refKeys");
        for (int i = 0; i < roles.length; i++) {
            refs.addObject().put("role", roles[i]).put("applied", true);
            keys.addObject().put("role", roles[i])
                    .put("key", IpStudioFixtures.sourceKey(USER, "ref-" + i + ".png"))
                    .put("refIndex", i);
        }
        exec.put("isMaster", false);
        exec.put("unitCost", unit);
        exec.put("holdTotal", holdTotal);
        return save(IpRun.builder()
                .id(RID).projectId(PID).ownerUserId(USER).nodeId("n-gen")
                .kind(IpRun.KIND_GENERATE).status(IpRun.STATUS_RUNNING).stage("queued").pct(2)
                .cost(holdTotal)
                .inputJson(write(inputs))
                .createdAt(Instant.now()).heartbeatAt(Instant.now())
                .build());
    }

    private IpRun seedIdentityRun(String sourceKey) {
        ObjectNode inputs = OM.createObjectNode();
        inputs.put("count", 1);
        ObjectNode exec = inputs.putObject("_exec");
        if (sourceKey != null) exec.put("sourceKey", sourceKey);
        exec.put("system", "你是 IP 形象设定师。");
        exec.put("user", "请输出人物特征卡 JSON。");
        exec.put("unitCost", 2L);
        exec.put("holdTotal", 2L);
        return save(IpRun.builder()
                .id(RID).projectId(PID).ownerUserId(USER).nodeId("n-identity")
                .kind(IpRun.KIND_IDENTITY).status(IpRun.STATUS_RUNNING).stage("queued").pct(2)
                .cost(2L)
                .inputJson(write(inputs))
                .createdAt(Instant.now()).heartbeatAt(Instant.now())
                .build());
    }

    private IpRun save(IpRun r) {
        runs.repo.save(r);
        return r;
    }

    private static String write(ObjectNode n) {
        try {
            return OM.writeValueAsString(n);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private IpRun reload() {
        return runs.rows.get(RID);
    }

    // ── generate ─────────────────────────────────────────────

    @Test
    void allImagesSucceed_commitsPerImage_andNoRelease() {
        seedGenerateRun(4);
        when(multimodal.generateImage(anyString(), anyString(), anyList())).thenReturn(IpStudioFixtures.pngBytes());

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_DONE, r.getStatus());
        assertEquals(100, r.getPct());
        assertEquals(32L, r.getCost());
        assertNull(r.getErrorCode());
        verify(credits, times(4)).commitHold(eq(IpRunService.REF_TYPE), eq(RID), eq(8L), anyString());
        verify(credits, never()).releaseHold(anyString(), anyString(), anyString());
        assertEquals(4, candidates(r).size());
    }

    @Test
    void midBatchFailure_keepsSuccesses_releasesRemainder_andReportsErrorCode() {
        seedGenerateRun(4);
        when(multimodal.generateImage(anyString(), anyString(), anyList()))
                .thenReturn(IpStudioFixtures.pngBytes())
                .thenReturn(IpStudioFixtures.pngBytes())
                .thenThrow(new DapModelException("DAP_MODEL_HTTP_429", "上游限流"));

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("DAP_MODEL_HTTP_429", r.getErrorCode());
        assertEquals(16L, r.getCost(), "只为成功的两张付钱");
        assertEquals(2, candidates(r).size(), "已出的两张要留给用户");
        verify(credits, times(2)).commitHold(eq(IpRunService.REF_TYPE), eq(RID), eq(8L), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void zeroSuccess_isFailedWithOriginalCodeAndZeroCost() {
        seedGenerateRun(2);
        when(multimodal.generateImage(anyString(), anyString(), anyList()))
                .thenThrow(new DapModelException("DAP_MODEL_BAD_OUTPUT", "上游没给图"));

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("DAP_MODEL_BAD_OUTPUT", r.getErrorCode());
        assertEquals(0L, r.getCost());
        assertEquals(0, candidates(r).size(), "一张都没出，绝不留假产物");
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void commitHoldThrowingResponseStatusException_stillReleasesRemainder() {
        // commitHold 抛的是 ResponseStatusException（不是 BusinessException）——
        // 只抓 BusinessException 会跳过释放，把冻结额挂到 CreditHoldSweeper 三小时后才回来
        seedGenerateRun(2);
        when(multimodal.generateImage(anyString(), anyString(), anyList())).thenReturn(IpStudioFixtures.pngBytes());
        doThrow(new ResponseStatusException(HttpStatus.CONFLICT, "hold 已是终态"))
                .when(credits).commitHold(anyString(), anyString(), anyLong(), anyString());

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals(0L, r.getCost());
        assertEquals(0, candidates(r).size(), "commit 没成功就不许承认这张图");
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void cancelRequestedBetweenImages_keepsPaidImagesAndReleasesRest() {
        IpRun run = seedGenerateRun(4);
        when(multimodal.generateImage(anyString(), anyString(), anyList())).thenAnswer(inv -> {
            // 第一张出完就请求取消
            reload().setCancelRequested(true);
            return IpStudioFixtures.pngBytes();
        });

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_RUN_CANCELLED", r.getErrorCode());
        assertEquals(8L, r.getCost());
        assertEquals(1, candidates(r).size());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
        assertEquals("n-gen", run.getNodeId());
    }

    @Test
    void noReferenceAtAll_generatesTextToImage() {
        seedGenerateRun(1, 8L, 8L);   // 一个参考图都没有（主形象节点、用户也没传照片）
        when(multimodal.generateImage(anyString(), anyString(), isNull()))
                .thenReturn(IpStudioFixtures.pngBytes());

        worker.runBlocking(RID);

        assertEquals(IpRun.STATUS_DONE, reload().getStatus());
        verify(multimodal).generateImage(anyString(), eq("768x1024"), isNull());
    }

    // ── 身份参考图不可读：绝不降级成「照价出一张不像他的图」──

    @Test
    void unreadableMasterRef_failsBeforeSpendingAnything() {
        // 以前是边循环边读、读不到就静默丢掉：inputs.refs 里明明写着 applied=true，
        // 实际按纯文生图出图并照价扣满 —— 用户以为锁了脸，拿到的是陌生人。
        seedGenerateRun(2, 8L, 16L, "master", "source");
        when(imageInput.of(anyString())).thenReturn(null);

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_REF_UNREADABLE", r.getErrorCode());
        assertEquals(0L, r.getCost());
        verify(multimodal, never()).generateImage(anyString(), anyString(), anyList());
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void unreadableOptionalReference_isMarkedNotAppliedAndRunContinues() {
        seedGenerateRun(1, 8L, 8L, "source", "reference");
        // 身份锚读得到，局部参考读不到
        when(imageInput.of(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0, String.class);
            return key.endsWith("ref-1.png") ? null : "https://cdn.test/" + key;
        });
        when(multimodal.generateImage(anyString(), anyString(), anyList()))
                .thenReturn(IpStudioFixtures.pngBytes());

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_DONE, r.getStatus());
        com.fasterxml.jackson.databind.JsonNode refs = readJson(r.getInputJson()).path("refs");
        assertTrue(refs.get(0).path("applied").asBoolean(), "身份锚仍生效");
        assertFalse(refs.get(1).path("applied").asBoolean(), "读不到的局部参考必须如实标未生效");
        assertEquals("unreadable", refs.get(1).path("reason").asText());
        // 只带得动的那一张进了模型请求
        verify(multimodal).generateImage(anyString(), eq("768x1024"), eq(List.of("https://cdn.test/"
                + IpStudioFixtures.sourceKey(USER, "ref-0.png"))));
    }

    // ── 单价快照：hold 与 commit 之间后台改价，不许按新价结算 ──

    @Test
    void commitsUseHeldUnitPriceEvenIfAdminChangesItMidRun() {
        seedGenerateRun(4, 8L, 32L, "source");           // 冻结时 8/张 × 4 = 32
        when(pricing.ipImage()).thenReturn(99L);          // 运行途中运营把单价改成 99
        when(multimodal.generateImage(anyString(), anyString(), anyList()))
                .thenReturn(IpStudioFixtures.pngBytes());

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_DONE, r.getStatus());
        assertEquals(32L, r.getCost(), "结算必须用冻结时的单价");
        verify(credits, times(4)).commitHold(eq(IpRunService.REF_TYPE), eq(RID), eq(8L), anyString());
        verify(credits, never()).commitHold(anyString(), anyString(), eq(99L), anyString());
        verify(credits, never()).releaseHold(anyString(), anyString(), anyString());
    }

    @Test
    void partialCommitAgainstSnapshotReleasesTheRemainder() {
        seedGenerateRun(4, 8L, 32L, "source");
        when(pricing.ipImage()).thenReturn(1L);           // 就算现价变得很低，剩余仍按冻结额退
        when(multimodal.generateImage(anyString(), anyString(), anyList()))
                .thenReturn(IpStudioFixtures.pngBytes())
                .thenThrow(new DapModelException("DAP_MODEL_HTTP_500", "上游炸了"));

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(8L, r.getCost());
        verify(credits, times(1)).commitHold(eq(IpRunService.REF_TYPE), eq(RID), eq(8L), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    // ── 产物必须是真图片 ──

    @Test
    void providerReturnsNonImageBytes_isBadOutputFailureAndNothingIsStored() {
        seedGenerateRun(2, 8L, 16L, "source");
        when(multimodal.generateImage(anyString(), anyString(), anyList()))
                .thenReturn("{\"error\":\"quota exceeded\"}".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("DAP_MODEL_BAD_OUTPUT", r.getErrorCode());
        assertEquals(0L, r.getCost());
        verify(storage, never()).store(any(byte[].class), anyString(), anyString(), anyString(), anyString());
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    // ── 派发失败（线程池排满）──

    @Test
    void abandon_marksFailedAndReleasesHold() {
        seedGenerateRun(4, 8L, 32L, "source");

        worker.abandon(RID, "IP_RUN_QUEUE_FULL", "生成队列已排满，积分已退回，请稍后再试");

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_RUN_QUEUE_FULL", r.getErrorCode());
        assertEquals(0L, r.getCost(), "没跑过一张，冻结额全退");
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
        verify(multimodal, never()).generateImage(anyString(), anyString(), anyList());
    }

    @Test
    void abandon_isNoOpOnTerminalRun() {
        IpRun r = seedGenerateRun(1, 8L, 8L, "source");
        r.setStatus(IpRun.STATUS_DONE);
        runs.repo.save(r);

        worker.abandon(RID, "IP_RUN_QUEUE_FULL", "生成队列已排满");

        assertEquals(IpRun.STATUS_DONE, reload().getStatus());
        verify(credits, never()).releaseHold(anyString(), anyString(), anyString());
    }

    // ── identity ─────────────────────────────────────────────

    @Test
    void identitySucceeds_commitsOnceAndStoresCard() {
        seedIdentityRun(IpStudioFixtures.sourceKey(USER, "photo.jpg"));
        ObjectNode reply = OM.createObjectNode();
        reply.put("text", "脸型：鹅蛋脸\n标志性特征：左脸颊创可贴");
        reply.put("promptEn", "same person, consistent facial identity, oval face");
        when(multimodal.chatJsonWithImages(anyString(), anyString(), anyList())).thenReturn(reply);

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_DONE, r.getStatus());
        assertEquals(2L, r.getCost());
        verify(credits).commitHold(eq(IpRunService.REF_TYPE), eq(RID), eq(2L), anyString());
        assertTrue(r.getOutputJson().contains("创可贴"));
    }

    @Test
    void identityVisionFailure_is_IP_IDENTITY_EXTRACT_FAILED_andRefunds() {
        seedIdentityRun(IpStudioFixtures.sourceKey(USER, "photo.jpg"));
        when(multimodal.chatJsonWithImages(anyString(), anyString(), anyList()))
                .thenThrow(new DapModelException("DAP_MODEL_HTTP_400", "模型不支持图片输入"));

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_IDENTITY_EXTRACT_FAILED", r.getErrorCode());
        assertNotNull(r.getErrorMessage());
        assertTrue(r.getErrorMessage().contains("不支持图片输入") || r.getErrorMessage().contains("看图"));
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void identityEmptyOutput_isFailedNotFakedEmptyCard() {
        seedIdentityRun(IpStudioFixtures.sourceKey(USER, "photo.jpg"));
        when(multimodal.chatJsonWithImages(anyString(), anyString(), anyList()))
                .thenReturn(OM.createObjectNode());

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_IDENTITY_EXTRACT_FAILED", r.getErrorCode());
        assertNull(r.getOutputJson());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void identityUnreadablePhoto_isFailedAndRefunded() {
        seedIdentityRun(IpStudioFixtures.sourceKey(USER, "gone.jpg"));
        when(imageInput.of(anyString())).thenReturn(null);

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_NODE_INPUT_MISSING", r.getErrorCode());
        verify(multimodal, never()).chatJsonWithImages(anyString(), anyString(), any());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void identityCancelledBeforeModelCall_costsNothing() {
        IpRun run = seedIdentityRun(IpStudioFixtures.sourceKey(USER, "photo.jpg"));
        run.setCancelRequested(true);
        runs.repo.save(run);

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_RUN_CANCELLED", r.getErrorCode());
        verify(multimodal, never()).chatJsonWithImages(anyString(), anyString(), any());
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void identityCancelledDuringModelCall_isNotCharged() {
        // 抽取本身没法中断，但既然还没扣款，就不该在用户取消之后再扣
        seedIdentityRun(IpStudioFixtures.sourceKey(USER, "photo.jpg"));
        ObjectNode reply = OM.createObjectNode();
        reply.put("text", "脸型：鹅蛋脸");
        when(multimodal.chatJsonWithImages(anyString(), anyString(), anyList())).thenAnswer(inv -> {
            reload().setCancelRequested(true);
            return reply;
        });

        worker.runBlocking(RID);

        IpRun r = reload();
        assertEquals(IpRun.STATUS_FAILED, r.getStatus());
        assertEquals("IP_RUN_CANCELLED", r.getErrorCode());
        verify(credits, never()).commitHold(anyString(), anyString(), anyLong(), anyString());
        verify(credits).releaseHold(eq(IpRunService.REF_TYPE), eq(RID), anyString());
    }

    @Test
    void alreadyTerminalRunIsSkipped() {
        IpRun r = seedGenerateRun(1);
        r.setStatus(IpRun.STATUS_DONE);
        runs.repo.save(r);
        worker.runBlocking(RID);
        verify(multimodal, never()).generateImage(anyString(), anyString(), anyList());
    }

    private com.fasterxml.jackson.databind.JsonNode readJson(String json) {
        try {
            return OM.readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private List<com.fasterxml.jackson.databind.JsonNode> candidates(IpRun r) {
        List<com.fasterxml.jackson.databind.JsonNode> out = new java.util.ArrayList<>();
        if (r.getOutputJson() == null) return out;
        try {
            OM.readTree(r.getOutputJson()).path("candidates").forEach(out::add);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
        return out;
    }
}
