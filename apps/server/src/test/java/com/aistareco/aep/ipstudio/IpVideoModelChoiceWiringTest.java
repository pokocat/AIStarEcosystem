package com.aistareco.aep.ipstudio;

import com.aistareco.aep.dap.service.DapAccountService;
import com.aistareco.aep.dap.service.DapMultimodalClient;
import com.aistareco.aep.dap.service.DapPricingService;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.aep.ipstudio.service.IpRunWorker;
import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.CelebrityActionPricingService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.ProductService;
import com.aistareco.aep.service.PromptService;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.materialvideo.MaterialVideoModelClient;
import com.aistareco.aep.service.materialvideo.MaterialVideoWorker;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import static com.aistareco.aep.ipstudio.IpStudioFixtures.OM;
import static com.aistareco.aep.ipstudio.IpStudioFixtures.USER;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 画布出视频：用户选的模型必须就是**被校验、被计价、被 worker 调用**的那个。
 *
 * <p>这一条不能只测 {@code IpRunService} 一侧。上一次它坏掉的方式就是两边各写各的：
 * 画布把模型 id 写在 item 顶层，通用视频链只读 {@code variant_config.endpoint_id} ——
 * 各自的单测都是绿的（§8.0.1 ⑦），而画布上选哪个模型，跑的都是后台默认那个。
 * 所以这里把真的 {@link MaterialVideoJobService} 接上，只替身掉厂商客户端和账本。
 */
class IpVideoModelChoiceWiringTest {

    private static final String PID = "IPP-22222222";

    private MaterialVideoModelClient modelClient;
    private CreditService credits;
    private MaterialVideoJobRepository jobRepo;
    private IpRunService svc;

    @BeforeEach
    void setUp() {
        IpStudioFixtures.Projects projects = new IpStudioFixtures.Projects();
        IpStudioFixtures.Runs runs = new IpStudioFixtures.Runs();
        IpCatalogService catalog = new IpCatalogService(OM);
        IpProjectService projectService = new IpProjectService(projects.repo, runs.repo, catalog,
                IpStudioFixtures.templateResolver(), IpStudioFixtures.storage(), IpStudioFixtures.props(),
                IpStudioFixtures.videoJobs(), OM, org.mockito.Mockito.mock(com.aistareco.aep.ipstudio.repository.IpProjectRevisionRepository.class));
        projects.repo.save(IpStudioFixtures.project(PID, USER, IpStudioFixtures.chainDoc(null, 0)));

        modelClient = mock(MaterialVideoModelClient.class);
        credits = mock(CreditService.class);
        jobRepo = mock(MaterialVideoJobRepository.class);
        when(jobRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        MaterialVideoJobService videoJobs = new MaterialVideoJobService(jobRepo, modelClient,
                mock(MaterialVideoWorker.class), credits, mock(CelebrityActionPricingService.class),
                mock(ProductService.class), mock(AiModelInvocationService.class), OM, mock(CdnUrlSigner.class));

        svc = new IpRunService(runs.repo, projectService, catalog, IpStudioFixtures.props(),
                mock(PromptService.class), mock(DapMultimodalClient.class), mock(DapPricingService.class),
                mock(DapAccountService.class), mock(CreditService.class), mock(IpRunWorker.class), OM,
                videoJobs, mock(AiModelInvocationService.class));
    }

    @Test
    void theChosenModelIsValidatedPricedAndHandedToTheWorker() throws Exception {
        String ref = IpStudioFixtures.sourceKey(USER, "p.jpg");
        // 选中模型的报价（40 积分/秒 × 5 秒）；默认端点另有价格，用错了下面的 hold 金额就对不上
        when(modelClient.resolveCreditCostOverride("ep-h3", 5)).thenReturn(200L);
        when(modelClient.resolveCreditCostOverride(isNull(), anyInt())).thenReturn(999L);

        svc.generateVideo(USER, PID, new IpRunService.IpVideoRequest("让它挥手", ref, 5, "9:16", "ep-h3"));

        // 时长按选中模型的区间校验（画布前端也是按它夹的时长）
        verify(modelClient).validateRequest("ep-h3", 5);
        verify(modelClient, never()).validateRequest(isNull(), anyInt());
        // 冻结的是选中模型的价
        verify(credits).hold(eq(USER), eq(200L), eq("material_video_job"), anyString(), anyString());

        ArgumentCaptor<MaterialVideoJob> saved = ArgumentCaptor.forClass(MaterialVideoJob.class);
        verify(jobRepo).save(saved.capture());
        assertEquals(MaterialVideoJobService.APP_IPSTUDIO, saved.getValue().getApp());
        assertEquals(200L, saved.getValue().getCreditsHeld());
        // worker 调哪个端点、用哪张首帧，只看落库的 variant_config
        JsonNode vc = OM.readTree(saved.getValue().getVariantConfigJson());
        assertEquals("ep-h3", vc.path("endpoint_id").asText());
        assertEquals(ref, vc.path("first_frame_key").asText());
    }

    @Test
    void withoutAChoice_theDefaultEndpointIsUsedEverywhere() {
        when(modelClient.resolveCreditCostOverride(isNull(), eq(5))).thenReturn(150L);

        svc.generateVideo(USER, PID, new IpRunService.IpVideoRequest("让它挥手", null, 5, "9:16", null));

        verify(modelClient).validateRequest(isNull(), eq(5));
        verify(credits).hold(eq(USER), eq(150L), eq("material_video_job"), anyString(), anyString());
        ArgumentCaptor<MaterialVideoJob> saved = ArgumentCaptor.forClass(MaterialVideoJob.class);
        verify(jobRepo).save(saved.capture());
        String vc = saved.getValue().getVariantConfigJson();
        assertFalse(vc != null && vc.contains("endpoint_id"), "没选模型时不该落 endpoint_id：" + vc);
    }
}
