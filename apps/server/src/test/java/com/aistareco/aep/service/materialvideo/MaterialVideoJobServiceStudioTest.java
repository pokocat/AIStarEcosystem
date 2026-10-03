package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.ProductService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 视频生成区接进通用视频链时 MaterialVideoJobService 的几处改动（docs/video-studio-plan.md §5.1 / §5.7）：
 * <ul>
 *   <li>分区闸：原生规格只许视频生成区带，首帧 key 只许画布与视频生成区带 —— 素材运营的 HTTP 入口
 *       会把客户端的 variant_config 原样透传，挡不住就是按带货单价开出原生能力、拿别人的 key 出片；</li>
 *   <li>credit_label 随任务存进 payload（worker 扣 / 退时用），但不进 MaterialVideo 卡片；</li>
 *   <li>defaultUnitCost 对外可读（视频生成区的每条固定价报价用它）。</li>
 * </ul>
 */
class MaterialVideoJobServiceStudioTest {

    private final ObjectMapper om = new ObjectMapper();
    private MaterialVideoJobRepository jobRepo;
    private MaterialVideoModelClient modelClient;
    private CreditService creditService;
    private CelebrityActionPricingService actionPricing;
    private MaterialVideoJobService svc;

    @BeforeEach
    void setUp() {
        jobRepo = mock(MaterialVideoJobRepository.class);
        modelClient = mock(MaterialVideoModelClient.class);
        creditService = mock(CreditService.class);
        actionPricing = mock(CelebrityActionPricingService.class);
        svc = new MaterialVideoJobService(jobRepo, modelClient, mock(MaterialVideoWorker.class), creditService,
                actionPricing, mock(ProductService.class), mock(AiModelInvocationService.class), om,
                mock(CdnUrlSigner.class));
        doNothing().when(modelClient).validateRequest(any(), anyInt());
        when(jobRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    private JsonNode body(String variantConfig) {
        try {
            return om.readTree("{\"items\":[{\"name\":\"v\",\"kind\":\"baseline\",\"prompt\":\"p\",\"duration_sec\":5,"
                    + "\"credit_cost\":200,\"credit_label\":\"视频生成\",\"variant_config\":" + variantConfig + "}]}");
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void assertRejected(String variantConfig, String app) {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.submit(body(variantConfig), "u1", app));
        assertEquals("VIDEO_MODE_UNSUPPORTED", e.getCode());
    }

    @Test
    @DisplayName("原生规格（模式 / 清晰度 / 种子 / 尾帧 / 参考素材）只许视频生成区带：其它分区在冻结之前 400")
    void nativeOptionsOnlyInVideoStudio() {
        for (String app : List.of(MaterialVideoJobService.APP_CELEBRITY, MaterialVideoJobService.APP_DRAMA,
                MaterialVideoJobService.APP_IPSTUDIO)) {
            assertRejected("{\"generation_mode\":\"t2v\"}", app);
            assertRejected("{\"resolution_tier\":\"544p\"}", app);
            assertRejected("{\"seed\":1}", app);
            assertRejected("{\"last_frame_key\":\"video-studio-image/u2/x.png\"}", app);
            assertRejected("{\"reference_inputs\":[{\"media_type\":\"image\",\"key\":\"video-studio-image/u2/x.png\"}]}", app);
        }
        verify(creditService, never()).hold(any(), anyLong(), any(), any(), any());
        verify(jobRepo, never()).save(any());
    }

    @Test
    @DisplayName("首帧 key 只许画布、视频生成区、短剧带（三处都由服务端组装并验过归属）：素材运营的 variant_config 里出现就 400")
    void firstFrameKeyOnlyInServerAssembledApps() {
        assertRejected("{\"first_frame_key\":\"ipstudio_gen/u2/a.png\"}", MaterialVideoJobService.APP_CELEBRITY);
        assertRejected("{\"first_frame_key\":\"ipstudio_gen/u2/a.png\"}", null); // 未传分区 = 带货线

        svc.submit(body("{\"first_frame_key\":\"ipstudio_gen/u1/a.png\",\"endpoint_id\":\"ep\"}"), "u1",
                MaterialVideoJobService.APP_IPSTUDIO);
        // 短剧：2026-09-30 首帧热修后 renderClip / 短剧画布会写 first_frame_key（确认属于本人之后）
        svc.submit(body("{\"target\":\"shot\",\"first_frame_key\":\"drama/frames/f1.png\",\"endpoint_id\":\"ep\"}"), "u1",
                MaterialVideoJobService.APP_DRAMA);
        verify(jobRepo, org.mockito.Mockito.times(2)).save(any());
    }

    @Test
    @DisplayName("带货 / 短剧线自己的 variant_config（六轴画面、镜头信息）照常放行")
    void existingVariantConfigsStillPass() {
        svc.submit(body("{\"character\":\"human-001\",\"scene\":\"home-kitchen\",\"voice\":\"voice-fem-01\"}"), "u1",
                MaterialVideoJobService.APP_CELEBRITY);
        svc.submit(body("{\"target\":\"shot\",\"scene_id\":\"s1\",\"endpoint_id\":\"ep\"}"), "u1",
                MaterialVideoJobService.APP_DRAMA);
        verify(creditService, org.mockito.Mockito.times(2)).hold(eq("u1"), eq(200L), any(), any(), any());
    }

    @Test
    @DisplayName("视频生成区：完整原生规格放行；credit_label 存进 payload、冻结文案用它，卡片上不出现")
    void videoStudioSubmitPersistsCreditLabel() {
        List<JsonNode> cards = svc.submit(body("""
                {"endpoint_id":"ep-h3","generation_mode":"universal_reference_video","resolution_tier":"768p","seed":42,
                 "reference_inputs":[{"media_type":"image","key":"video-studio-image/u1/a.png"}]}"""),
                "u1", MaterialVideoJobService.APP_VIDEO_STUDIO);

        ArgumentCaptor<MaterialVideoJob> saved = ArgumentCaptor.forClass(MaterialVideoJob.class);
        verify(jobRepo).save(saved.capture());
        MaterialVideoJob job = saved.getValue();
        assertEquals(MaterialVideoJobService.APP_VIDEO_STUDIO, job.getApp());
        assertEquals(200L, job.getCreditsHeld());
        assertEquals("视频生成", MaterialVideoWorker.creditLabelOf(job));
        verify(creditService).hold(eq("u1"), eq(200L), eq(MaterialVideoJobService.CREDIT_REF_TYPE), eq(job.getId()),
                eq("视频生成 · v"));
        assertFalse(cards.get(0).has("credit_label"));
    }

    @Test
    @DisplayName("defaultUnitCost：后台配了动作单价用它，没配 = 30")
    void defaultUnitCost() {
        when(actionPricing.creditPriceOf(CelebrityActionPricingService.ACTION_VIDEO_GENERATE)).thenReturn(null);
        assertEquals(30L, svc.defaultUnitCost());
        when(actionPricing.creditPriceOf(CelebrityActionPricingService.ACTION_VIDEO_GENERATE)).thenReturn(45L);
        assertEquals(45L, svc.defaultUnitCost());
    }
}
