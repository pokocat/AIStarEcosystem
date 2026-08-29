package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.dto.MaterialVideoModelsDto;
import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelBillingMode;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.ProductService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * v0.132 提交批次原子性 + 报价/冻结同源 + models 列表过滤（R1-10 / R2-4 验收项）：
 *   · 批内任一 item 时长非法 → 整批零 hold、零落库（校验先于任何冻结）；
 *   · PER_SECOND 报价展开后 hold 金额 == 报价（creditsHeld 同源）；
 *   · listModels 过滤 disabled / 未配置（无 key）端点，合成默认项标 selectableById=false。
 */
class MaterialVideoJobServiceSubmitTest {

    private final ObjectMapper om = new ObjectMapper();
    private MaterialVideoJobRepository jobRepo;
    private MaterialVideoModelClient modelClient;
    private CreditService creditService;
    private AiModelInvocationService invocation;
    private CelebrityActionPricingService actionPricing;
    private MaterialVideoJobService svc;

    @BeforeEach
    void setUp() {
        jobRepo = mock(MaterialVideoJobRepository.class);
        modelClient = mock(MaterialVideoModelClient.class);
        creditService = mock(CreditService.class);
        invocation = mock(AiModelInvocationService.class);
        actionPricing = mock(CelebrityActionPricingService.class);
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        svc = new MaterialVideoJobService(jobRepo, modelClient, mock(MaterialVideoWorker.class),
                creditService, actionPricing, mock(ProductService.class), invocation, om, signer);
    }

    private com.fasterxml.jackson.databind.JsonNode body(String json) {
        try {
            return om.readTree(json);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void batch_with_invalid_item_holds_nothing_and_saves_nothing() {
        // 第 2 个 item 时长非法（modelClient 校验抛 400）——第 1 个合法 item 也不得先 hold。
        doNothing().when(modelClient).validateRequest(isNull(), eq(10));
        doThrow(new BusinessException(org.springframework.http.HttpStatus.BAD_REQUEST,
                "VIDEO_DURATION_UNSUPPORTED", "超限")).when(modelClient).validateRequest(isNull(), eq(40));

        BusinessException e = assertThrows(BusinessException.class, () -> svc.submit(body("""
            {"items":[
              {"script_id":"s1","name":"v1","duration_sec":10},
              {"script_id":"s1","name":"v2","duration_sec":40}
            ]}"""), "user-1", MaterialVideoJobService.APP_CELEBRITY));
        assertEquals("VIDEO_DURATION_UNSUPPORTED", e.getCode());
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
        verify(jobRepo, never()).save(any());
    }

    @Test
    void per_second_quote_equals_credits_held() {
        doNothing().when(modelClient).validateRequest(any(), anyInt());
        when(modelClient.resolveCreditCostOverride(isNull(), eq(15))).thenReturn(600L); // 40/s × 15s
        when(jobRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        List<com.fasterxml.jackson.databind.JsonNode> cards = svc.submit(body("""
            {"items":[{"script_id":"s1","name":"v1","duration_sec":15}]}"""),
                "user-1", MaterialVideoJobService.APP_CELEBRITY);

        assertEquals(1, cards.size());
        verify(creditService).hold(eq("user-1"), eq(600L), eq("material_video_job"), any(), any());
        ArgumentCaptor<MaterialVideoJob> saved = ArgumentCaptor.forClass(MaterialVideoJob.class);
        verify(jobRepo).save(saved.capture());
        assertEquals(600L, saved.getValue().getCreditsHeld());
    }

    @Test
    void listModels_filters_disabled_and_unready_endpoints_and_marks_synthetic_default() {
        AiModelEndpoint ready = AiModelEndpoint.builder().id("ep-a").name("A")
                .baseUrl("https://a.example/v1").billingMode(AiModelBillingMode.PER_SECOND).enabled(true).build();
        AiModelEndpoint noKey = AiModelEndpoint.builder().id("ep-b").name("B")
                .baseUrl("https://b.example/v1").enabled(true).build();
        AiAppEndpointCandidate cA = AiAppEndpointCandidate.builder()
                .endpointId("ep-a").enabled(true).creditCostOverride(40L).maxDurationSec(15).build();
        AiAppEndpointCandidate cB = AiAppEndpointCandidate.builder().endpointId("ep-b").enabled(true).build();
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION)).thenReturn(List.of(
                new AiModelInvocationService.ResolvedEndpoint(ready, cA, true),
                new AiModelInvocationService.ResolvedEndpoint(noKey, cB, false)));
        when(modelClient.isEndpointReady(ready)).thenReturn(true);
        when(modelClient.isEndpointReady(noKey)).thenReturn(false); // 无 key → 不出 wire
        when(modelClient.protocolDurationBounds(ready))
                .thenReturn(new MaterialVideoModelClient.DurationBounds(5, 15));

        MaterialVideoModelsDto dto = svc.listModels();
        assertEquals(1, dto.video().size());
        MaterialVideoModelsDto.VideoModelOptionDto opt = dto.video().get(0);
        assertEquals("ep-a", opt.endpointId());
        assertTrue(opt.selectableById());
        assertEquals("per_second", opt.billingUnit());
        assertEquals(40L, opt.creditCost());
        assertEquals(5, opt.effectiveMinDurationSec());
        assertEquals(15, opt.effectiveMaxDurationSec());

        // 无任何 candidate 时合成默认项：selectableById=false（显式传 id 会被白名单拒）。
        when(invocation.listCandidates(AiModelPurpose.VIDEO_GENERATION)).thenReturn(List.of());
        when(invocation.resolveEndpoint(AiModelPurpose.VIDEO_GENERATION)).thenReturn(Optional.of(ready));
        when(actionPricing.creditPriceOf(any())).thenReturn(null);
        MaterialVideoModelsDto fallback = svc.listModels();
        assertEquals(1, fallback.video().size());
        assertFalse(fallback.video().get(0).selectableById());
        assertNull(fallback.video().get(0).capability());
    }
}
