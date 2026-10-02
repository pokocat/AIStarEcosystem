package com.aistareco.aep.service;

import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.StorageAsset;
import com.aistareco.aep.repository.DramaCharacterRepository;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.repository.DramaSceneRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * C-1/C-3 参考生效回报（applied_refs）纯函数矩阵（DramaRenderService 侧）：
 * computeFrameAppliedRefs（角色定妆锁脸参考的 fetchable 过滤，role=ref）/ supportsFirstLastFrame（协议关键字
 * 静态判定，与 MaterialVideoModelClient.protocolFor 同口径）+ D-11 非法 endpoint_id → 503 不扣费。
 * 首/末帧槽位归类（classifyClipFrames）已下沉 DramaReferenceAssembler（见 DramaReferenceAssemblerTest）。无 Spring / 无网络。
 */
class DramaRenderServiceTest {

    private final ObjectMapper om = new ObjectMapper();

    private ArrayNode refs(String... urls) {
        ArrayNode arr = om.createArrayNode();
        for (String u : urls) arr.add(u);
        return arr;
    }

    // ── computeFrameAppliedRefs ─────────────────────────────────────────────

    @Test
    void frame_all_fetchable_refs_applied() {
        var a = DramaRenderService.computeFrameAppliedRefs(
                refs("https://cdn.example.com/a.png", "http://img.example.com/b.png"));
        assertEquals(2, a.requested());
        assertEquals(2, a.appliedCount());
        assertTrue(a.items().stream().allMatch(r -> "ref".equals(r.role()) && r.applied() && r.reason() == null));
    }

    @Test
    void frame_local_and_relative_refs_dropped_with_reason() {
        var a = DramaRenderService.computeFrameAppliedRefs(refs(
                "https://cdn.example.com/ok.png",
                "/cdn/drama/frames/x.png",              // dev fake-CDN 相对路径
                "http://localhost:8080/cdn/y.png",      // 本机地址
                "http://192.168.1.10/z.png"));          // 内网地址
        assertEquals(4, a.requested());
        assertEquals(1, a.appliedCount());
        assertEquals(java.util.List.of("https://cdn.example.com/ok.png"), a.validUrls());
        a.items().stream().filter(r -> !r.applied())
                .forEach(r -> assertEquals("local_unfetchable", r.reason()));
    }

    @Test
    void frame_null_or_empty_refs_yield_empty_report() {
        var a = DramaRenderService.computeFrameAppliedRefs(null);
        assertEquals(0, a.requested());
        assertEquals(0, a.appliedCount());
        var b = DramaRenderService.computeFrameAppliedRefs(refs("", "  "));
        assertEquals(0, b.requested());
    }

    // ── supportsFirstLastFrame ─────────────────────────────────────────────

    @Test
    void supports_flf_by_protocol_keywords() {
        assertTrue(DramaRenderService.supportsFirstLastFrame(
                AiModelEndpoint.builder().name("豆包 Seedance").model("doubao-seedance-pro").build()));
        // GENERIC：best-effort 带 end_image，视为支持（下游不认则忽略，不误报）
        assertTrue(DramaRenderService.supportsFirstLastFrame(
                AiModelEndpoint.builder().name("通用 i2v").baseUrl("https://api.vendor.com/v1").build()));
        // AGNES 仅首帧
        assertFalse(DramaRenderService.supportsFirstLastFrame(
                AiModelEndpoint.builder().name("Agnes Video").baseUrl("https://agnes.example.com").build()));
        assertFalse(DramaRenderService.supportsFirstLastFrame(null));
    }

    @Test
    void video_candidate_per_second_price_multiplies_duration_without_changing_legacy_per_call() {
        AiModelEndpoint h3 = AiModelEndpoint.builder().billingMode(AiModelBillingMode.PER_SECOND).build();
        AiAppEndpointCandidate candidate = AiAppEndpointCandidate.builder().creditCostOverride(40L).build();
        assertEquals(200L, DramaRenderService.effectiveVideoCreditCost(h3, candidate, 5, 30));

        AiModelEndpoint legacy = AiModelEndpoint.builder().billingMode(AiModelBillingMode.PER_CALL).build();
        assertEquals(40L, DramaRenderService.effectiveVideoCreditCost(legacy, candidate, 5, 30));
        assertEquals(30L, DramaRenderService.effectiveVideoCreditCost(h3,
                AiAppEndpointCandidate.builder().build(), 5, 30));
    }

    // ── D-11：非法 endpoint_id → 503 ENDPOINT_NOT_ALLOWED，且 0 扣费 / 0 提交 ──────────

    private final AiModelInvocationService invocation = mock(AiModelInvocationService.class);
    private final CreditService creditService = mock(CreditService.class);
    private final MaterialVideoJobService videoJobs = mock(MaterialVideoJobService.class);

    private DramaRenderService renderSvc() {
        return new DramaRenderService(
                invocation,
                mock(AiModelUsageService.class),
                mock(com.aistareco.aep.service.ai.UpstreamModelHttp.class),
                videoJobs,
                creditService,
                mock(CdnUploader.class),
                mock(CdnUrlSigner.class),
                mock(PlatformConfigService.class),
                mock(PromptService.class),
                mock(DramaReferenceAssembler.class),
                mock(StorageQuotaService.class),
                om,
                mock(com.aistareco.aep.service.materialvideo.MaterialVideoModelClient.class));
    }

    @Test
    void renderFrame_illegal_endpoint_id_503_and_no_charge() {
        // 传旧式 prompt 绕过 promptService；endpoint_id 不在候选池 → resolveEndpoint 返回 empty。
        when(invocation.resolveEndpoint(eq(AiModelPurpose.IMAGE_GENERATION), eq("ep-ghost")))
                .thenReturn(Optional.empty());
        ObjectNode body = om.createObjectNode();
        body.put("prompt", "一间昏暗的房间");
        body.put("kind", "shot");
        body.put("endpoint_id", "ep-ghost");

        BusinessException ex = assertThrows(BusinessException.class, () -> renderSvc().renderFrame(body, "u1"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertEquals("ENDPOINT_NOT_ALLOWED", ex.getCode());
        // §8.0：不扣费。
        verify(creditService, never()).debit(any(), anyLong(), any(), any(), any());
    }

    @Test
    void renderClip_illegal_endpoint_id_503_and_no_submit() {
        when(invocation.resolveEndpoint(eq(AiModelPurpose.VIDEO_GENERATION), eq("ep-ghost")))
                .thenReturn(Optional.empty());
        ObjectNode body = om.createObjectNode();
        body.put("prompt", "镜头缓缓推进");
        body.put("kind", "shot");
        body.put("endpoint_id", "ep-ghost");

        BusinessException ex = assertThrows(BusinessException.class, () -> renderSvc().renderClip(body, "u1"));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, ex.getStatus());
        assertEquals("ENDPOINT_NOT_ALLOWED", ex.getCode());
        // §8.0：不提交任务（videoJobs.submit 内部才 hold 积分）→ 不 hold。
        verify(videoJobs, never()).submit(any(), any(), any());
    }

    // ── 2026-09-30 热修：聚算 H3 上「生成视频」首帧送不到模型 ───────────────────────
    //
    // 聚算分支把提示词里的首帧标记剥掉、只认 variant_config.first_frame_key，而 renderClip 此前从没写过它
    // → 短剧 / 短视频在 H3 上选了首帧，出来的是文生视频，applied_refs 还报「已送达」。
    // 这里用真实的 DramaReferenceAssembler（仓库 / signer 是 mock），钉死 renderClip 交给视频管线的那份 item。

    private static final String OUR_FRAME_URL = "https://cdn.test/media/drama/frames/f1.png?auth_key=1-2-3";

    private final StorageAssetRepository storageAssetRepo = mock(StorageAssetRepository.class);
    private final MaterialVideoJobRepository videoJobRepo = mock(MaterialVideoJobRepository.class);
    private final CdnUrlSigner clipSigner = mock(CdnUrlSigner.class);

    private DramaRenderService clipSvc(boolean firstFrameByKey) {
        when(clipSigner.maybeSign(anyString())).thenAnswer(inv -> inv.getArgument(0));
        // 模拟 CdnUrlSigner#keyOf：只认我方 CDN 域，砍掉 query；外链 → null
        when(clipSigner.keyOf(anyString())).thenAnswer(inv -> {
            String u = inv.getArgument(0);
            if (!u.startsWith("https://cdn.test/")) return null;
            String rest = u.substring("https://cdn.test/".length());
            int q = rest.indexOf('?');
            return q >= 0 ? rest.substring(0, q) : rest;
        });
        when(videoJobs.firstFrameNeedsStorageKey(any())).thenReturn(firstFrameByKey);
        when(videoJobs.submit(any(), any(), any())).thenAnswer(inv -> List.of(om.createObjectNode().put("id", "mvj_1")));
        DramaReferenceAssembler assembler = new DramaReferenceAssembler(
                mock(DramaProjectRepository.class), mock(DramaCharacterRepository.class),
                mock(DramaSceneRepository.class), videoJobRepo, storageAssetRepo, clipSigner, om);
        return new DramaRenderService(
                invocation,
                mock(AiModelUsageService.class),
                mock(com.aistareco.aep.service.ai.UpstreamModelHttp.class),
                videoJobs,
                creditService,
                mock(CdnUploader.class),
                clipSigner,
                mock(PlatformConfigService.class),
                mock(PromptService.class),
                assembler,
                mock(StorageQuotaService.class),
                om);
    }

    private ObjectNode clipBody(String frameUrl) {
        ObjectNode body = om.createObjectNode();
        body.put("prompt", "她回头看向镜头"); // 旧式 prompt，绕过 promptService
        body.put("kind", "shot");
        body.put("duration_sec", 6);
        body.put("frame_url", frameUrl);
        return body;
    }

    /** renderClip 交给 videoJobs.submit 的那一个 item。 */
    private JsonNode submittedItem() {
        ArgumentCaptor<JsonNode> cap = ArgumentCaptor.forClass(JsonNode.class);
        verify(videoJobs).submit(cap.capture(), eq("u1"), eq(MaterialVideoJobService.APP_DRAMA));
        return cap.getValue().path("items").get(0);
    }

    private void ownLedger(String key) {
        when(storageAssetRepo.findByAppAndOwnerUserIdAndCdnKeyIn(eq("drama"), eq("u1"), any()))
                .thenAnswer(inv -> {
                    java.util.Collection<String> keys = inv.getArgument(2);
                    return keys.contains(key)
                            ? List.of(StorageAsset.builder().id("sa_1").app("drama").ownerUserId("u1")
                                    .category("分镜首帧").cdnKey(key).bytes(10).build())
                            : List.of();
                });
    }

    @Test
    void h3_own_frame_writes_first_frame_key_and_reports_delivered() {
        ownLedger("drama/frames/f1.png");

        JsonNode card = clipSvc(true).renderClip(clipBody(OUR_FRAME_URL), "u1");

        JsonNode item = submittedItem();
        // 与 IpRunService 同一个键、同一层：worker 的 extractFirstFrameKey 读的就是这里
        assertEquals("drama/frames/f1.png", item.path("variant_config").path("first_frame_key").asText(null));
        // 提示词首帧标记照留（seedance 等协议靠它；聚算分支自己会剥）
        assertTrue(item.path("prompt").asText().contains("（严格基于该首帧画面延展动态：" + OUR_FRAME_URL));
        JsonNode first = card.path("applied_refs").path("items").get(0);
        assertEquals("first_frame", first.path("role").asText());
        assertTrue(first.path("applied").asBoolean());
    }

    @Test
    void h3_frame_not_owned_400_before_hold_and_no_submit() {
        when(storageAssetRepo.findByAppAndOwnerUserIdAndCdnKeyIn(any(), any(), any())).thenReturn(List.of());
        when(videoJobRepo.findScopedByLastFrameCdnKeyIn(any(), any(), any())).thenReturn(List.of());

        BusinessException ex = assertThrows(BusinessException.class,
                () -> clipSvc(true).renderClip(clipBody("https://cdn.test/media/drama/frames/someone-else.png"), "u1"));

        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertEquals("DRAMA_FRAME_NOT_OWNED", ex.getCode());
        // 不建任务、不冻结（hold 只发生在 videoJobs.submit 里）
        verify(videoJobs, never()).submit(any(), any(), any());
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
    }

    @Test
    void h3_external_frame_no_key_and_applied_refs_says_not_delivered() {
        JsonNode card = clipSvc(true).renderClip(clipBody("https://img.vendor.example/f.png"), "u1");

        JsonNode item = submittedItem();
        assertFalse(item.path("variant_config").has("first_frame_key"));
        JsonNode first = card.path("applied_refs").path("items").get(0);
        assertFalse(first.path("applied").asBoolean(), "外链在聚算协议下送不到，不许报已送达");
        assertEquals("not_in_storage", first.path("reason").asText());
        assertEquals(0, card.path("applied_refs").path("applied").asInt());
    }

    @Test
    void seedance_path_keeps_prompt_marker_and_does_not_touch_key_or_ownership() {
        JsonNode card = clipSvc(false).renderClip(clipBody(OUR_FRAME_URL), "u1");

        JsonNode item = submittedItem();
        assertTrue(item.path("prompt").asText().contains("（严格基于该首帧画面延展动态：" + OUR_FRAME_URL + "）"));
        assertFalse(item.path("variant_config").has("first_frame_key"));
        // 走 URL 的协议：照旧按 URL 可抓取判定送达，不查归属
        assertTrue(card.path("applied_refs").path("items").get(0).path("applied").asBoolean());
        verify(storageAssetRepo, never()).findByAppAndOwnerUserIdAndCdnKeyIn(any(), any(), any());
    }
}
