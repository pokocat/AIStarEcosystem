package com.aistareco.aep.service;

import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
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
                om);
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
}
