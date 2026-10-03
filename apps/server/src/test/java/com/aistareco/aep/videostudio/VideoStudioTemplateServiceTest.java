package com.aistareco.aep.videostudio;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplate;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplateCreateRequest;
import com.aistareco.aep.videostudio.model.StudioTemplate;
import com.aistareco.aep.videostudio.repository.StudioTemplateRepository;
import com.aistareco.aep.videostudio.service.VideoStudioTemplateService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 模板 / 做同款（docs/video-studio-plan.md §10）：谁能存、谁能发官方、谁看得到、谁能撤；
 * 配方只拷「怎么做」，不拷运行痕迹；成片 / 封面只存 key、出 wire 现签。断错误码，不断文案。
 */
class VideoStudioTemplateServiceTest {

    private static final String USER = "u1";

    private final ObjectMapper om = new ObjectMapper();
    private StudioTemplateRepository repo;
    private MaterialVideoJobRepository jobRepo;
    private FileStorageService fileStorage;
    private InAppOperatorGuard operators;
    private VideoStudioTemplateService svc;

    @BeforeEach
    void setUp() {
        repo = mock(StudioTemplateRepository.class);
        jobRepo = mock(MaterialVideoJobRepository.class);
        fileStorage = mock(FileStorageService.class);
        operators = mock(InAppOperatorGuard.class);
        svc = new VideoStudioTemplateService(repo, jobRepo, fileStorage, operators, om);
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(fileStorage.signedUrl(anyString())).thenAnswer(i -> "https://cdn.test/" + i.getArgument(0) + "?sig=1");
        when(fileStorage.keyOfStoredUrl("https://oss.example/material-videos/mvj_1/video.mp4"))
                .thenReturn("material-videos/mvj_1/video.mp4");
        when(fileStorage.keyOfStoredUrl("https://oss.example/material-videos/mvj_1/thumbnail.jpg"))
                .thenReturn("material-videos/mvj_1/thumbnail.jpg");
        when(jobRepo.findById("mvj_1")).thenReturn(Optional.of(job(USER, MaterialVideoJobService.APP_VIDEO_STUDIO, "succeeded")));
    }

    private static MaterialVideoJob job(String owner, String app, String status) {
        return MaterialVideoJob.builder().id("mvj_1").ownerUserId(owner).app(app).status(status).kind("studio-ref")
                .prompt("图1在跳舞，配上音频1").aspectRatio("9:16").durationSec(6)
                .variantConfigJson("""
                    {"endpoint_id":"ep-h3","generation_mode":"universal_reference_video","resolution_tier":"768p","seed":7,
                     "reference_inputs":[{"media_type":"image","key":"video-studio-image/u1/a.png"},
                                         {"media_type":"audio","key":"video-studio-audio/u1/b.mp3"}],
                     "optimization_id":"vso_9","original_prompt":"跳舞"}""")
                .externalTaskId("job_vendor_1").errorMessage("old error").creditsHeld(240L)
                .providerUsed("MiniMax H3").modelUsed("minimax-h3")
                .videoUrl("https://oss.example/material-videos/mvj_1/video.mp4")
                .thumbnailUrl("https://oss.example/material-videos/mvj_1/thumbnail.jpg")
                .createdAt(OffsetDateTime.now()).build();
    }

    private static VideoStudioTemplateCreateRequest create(String title, String description, Boolean official) {
        return new VideoStudioTemplateCreateRequest("mvj_1", title, description, official);
    }

    private String code(Runnable call) {
        return assertThrows(BusinessException.class, call::run).getCode();
    }

    private StudioTemplate stored(String id, String scope, String owner, String status) {
        StudioTemplate t = StudioTemplate.builder().id(id).ownerUserId(owner).scope(scope).status(status)
                .title("模板").sourceJobId("mvj_1").useCount(3)
                .recipeJson("{\"mode\":\"t2v\",\"prompt\":\"p\",\"resolutionTier\":\"768p\",\"aspectRatio\":\"9:16\","
                        + "\"seconds\":5,\"seed\":null,\"endpointId\":null,\"modelName\":null,\"materials\":[]}")
                .createdAt(Instant.parse("2026-09-30T12:00:00Z")).build();
        when(repo.findById(id)).thenReturn(Optional.of(t));
        return t;
    }

    // ── 存模板 ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("存成私有模板：配方只拷模式 / 最终提示词 / 规格 / 种子 / 模型 / 素材，成片与封面存 key")
    void savesPrivateTemplateWithCleanRecipe() throws Exception {
        VideoStudioTemplate dto = svc.create(USER, create("  图1跳舞  ", "  ", null));

        ArgumentCaptor<StudioTemplate> saved = ArgumentCaptor.forClass(StudioTemplate.class);
        verify(repo).save(saved.capture());
        StudioTemplate t = saved.getValue();
        assertTrue(t.getId().startsWith("vst_") && t.getId().length() <= 32, t.getId());
        assertEquals(StudioTemplate.SCOPE_PRIVATE, t.getScope());
        assertEquals(StudioTemplate.STATUS_ACTIVE, t.getStatus());
        assertEquals("图1跳舞", t.getTitle());
        assertNull(t.getDescription());
        assertEquals("mvj_1", t.getSourceJobId());
        assertEquals("material-videos/mvj_1/video.mp4", t.getPreviewVideoKey());
        assertEquals("material-videos/mvj_1/thumbnail.jpg", t.getPreviewThumbnailKey());
        assertEquals(0, t.getUseCount());

        JsonNode recipe = om.readTree(t.getRecipeJson());
        assertEquals("universal_reference_video", recipe.path("mode").asText());
        assertEquals("图1在跳舞，配上音频1", recipe.path("prompt").asText());
        assertEquals(7, recipe.path("seed").asInt());
        assertEquals("ep-h3", recipe.path("endpointId").asText());
        assertEquals("MiniMax H3", recipe.path("modelName").asText());
        assertEquals("[{\"role\":\"reference\",\"mediaType\":\"image\",\"key\":\"video-studio-image/u1/a.png\",\"label\":\"图1\"},"
                + "{\"role\":\"reference\",\"mediaType\":\"audio\",\"key\":\"video-studio-audio/u1/b.mp3\",\"label\":\"音频1\"}]",
                recipe.path("materials").toString());
        String raw = t.getRecipeJson();
        for (String trace : List.of("job_vendor_1", "old error", "240", "vso_9", "succeeded", "external", "credit")) {
            assertFalse(raw.contains(trace), "配方不该带运行痕迹：" + trace);
        }

        assertTrue(dto.mine());
        assertEquals("private", dto.scope());
        assertEquals("https://cdn.test/material-videos/mvj_1/video.mp4?sig=1", dto.previewVideoUrl());
        assertEquals("https://cdn.test/video-studio-audio/u1/b.mp3?sig=1", dto.materials().get(1).url());
        assertEquals("音频1", dto.materials().get(1).label());
    }

    @Test
    @DisplayName("发布官方模板：运营（查库）可以；不是运营 → 403 VIDEO_STUDIO_TEMPLATE_FORBIDDEN，不落库")
    void officialRequiresOperator() {
        when(operators.isOperatorUserId(USER)).thenReturn(false);
        assertEquals("VIDEO_STUDIO_TEMPLATE_FORBIDDEN", code(() -> svc.create(USER, create("t", null, true))));
        verify(repo, never()).save(any());

        when(operators.isOperatorUserId(USER)).thenReturn(true);
        assertEquals("official", svc.create(USER, create("t", "运营精选", true)).scope());
        verify(operators, org.mockito.Mockito.atLeastOnce()).isOperatorUserId(USER);
    }

    @Test
    @DisplayName("任务不是本人的 / 不是本区的 / 没成功 / 不存在，标题 1–40 字、说明 ≤200 字 → 400 VIDEO_STUDIO_TEMPLATE_INVALID")
    void invalidSaves() {
        when(jobRepo.findById("mvj_1")).thenReturn(Optional.of(job("u2", MaterialVideoJobService.APP_VIDEO_STUDIO, "succeeded")));
        assertEquals("VIDEO_STUDIO_TEMPLATE_INVALID", code(() -> svc.create(USER, create("t", null, null))));
        when(jobRepo.findById("mvj_1")).thenReturn(Optional.of(job(USER, MaterialVideoJobService.APP_CELEBRITY, "succeeded")));
        assertEquals("VIDEO_STUDIO_TEMPLATE_INVALID", code(() -> svc.create(USER, create("t", null, null))));
        when(jobRepo.findById("mvj_1")).thenReturn(Optional.of(job(USER, MaterialVideoJobService.APP_VIDEO_STUDIO, "failed")));
        assertEquals("VIDEO_STUDIO_TEMPLATE_INVALID", code(() -> svc.create(USER, create("t", null, null))));
        when(jobRepo.findById("mvj_1")).thenReturn(Optional.empty());
        assertEquals("VIDEO_STUDIO_TEMPLATE_INVALID", code(() -> svc.create(USER, create("t", null, null))));
        assertEquals("VIDEO_STUDIO_TEMPLATE_INVALID", code(() -> svc.create(USER, null)));

        when(jobRepo.findById("mvj_1")).thenReturn(Optional.of(job(USER, MaterialVideoJobService.APP_VIDEO_STUDIO, "succeeded")));
        assertEquals("VIDEO_STUDIO_TEMPLATE_INVALID", code(() -> svc.create(USER, create("   ", null, null))));
        assertEquals("VIDEO_STUDIO_TEMPLATE_INVALID", code(() -> svc.create(USER, create("字".repeat(41), null, null))));
        assertEquals("VIDEO_STUDIO_TEMPLATE_INVALID", code(() -> svc.create(USER, create("t", "字".repeat(201), null))));
        verify(repo, never()).save(any());
        svc.create(USER, create("字".repeat(40), "字".repeat(200), null));
    }

    // ── 查询 / 可见性 ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("列表：在架官方 + 自己的，最多 100 条；mine 标对")
    void list() {
        StudioTemplate official = stored("vst_o", StudioTemplate.SCOPE_OFFICIAL, "u9", StudioTemplate.STATUS_ACTIVE);
        StudioTemplate mine = stored("vst_m", StudioTemplate.SCOPE_PRIVATE, USER, StudioTemplate.STATUS_ACTIVE);
        when(repo.findVisible(eq(USER), any(Pageable.class))).thenReturn(List.of(mine, official));

        List<VideoStudioTemplate> out = svc.list(USER);
        assertEquals(List.of("vst_m", "vst_o"), out.stream().map(VideoStudioTemplate::id).toList());
        assertTrue(out.get(0).mine());
        assertFalse(out.get(1).mine());
        assertEquals(3, out.get(1).useCount());
        assertEquals("2026-09-30T12:00:00Z", out.get(1).createdAt());
        verify(repo).findVisible(USER, PageRequest.of(0, 100));
    }

    @Test
    @DisplayName("单个：官方且在架、或本人在架的看得到；别人的私有 / 已下架 / 不存在 → 404 VIDEO_STUDIO_TEMPLATE_NOT_FOUND")
    void visibility() {
        stored("vst_o", StudioTemplate.SCOPE_OFFICIAL, "u9", StudioTemplate.STATUS_ACTIVE);
        stored("vst_m", StudioTemplate.SCOPE_PRIVATE, USER, StudioTemplate.STATUS_ACTIVE);
        stored("vst_p", StudioTemplate.SCOPE_PRIVATE, "u9", StudioTemplate.STATUS_ACTIVE);
        stored("vst_w", StudioTemplate.SCOPE_OFFICIAL, "u9", StudioTemplate.STATUS_WITHDRAWN);
        stored("vst_mw", StudioTemplate.SCOPE_PRIVATE, USER, StudioTemplate.STATUS_WITHDRAWN);

        assertEquals("vst_o", svc.get(USER, "vst_o").id());
        assertEquals("vst_m", svc.get(USER, "vst_m").id());
        for (String id : List.of("vst_p", "vst_w", "vst_mw", "vst_none")) {
            assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(() -> svc.get(USER, id)), id);
        }
        assertTrue(svc.findVisible(USER, "vst_o").isPresent());
        assertTrue(svc.findVisible(USER, null).isEmpty());
    }

    // ── 撤回 ──────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("撤回：本人的 → 下架；官方的 → 任一运营可撤；别人的私有、非运营撤别人的官方、已下架 → 404")
    void withdrawRules() {
        StudioTemplate mine = stored("vst_m", StudioTemplate.SCOPE_PRIVATE, USER, StudioTemplate.STATUS_ACTIVE);
        svc.withdraw(USER, "vst_m");
        assertEquals(StudioTemplate.STATUS_WITHDRAWN, mine.getStatus());

        StudioTemplate official = stored("vst_o", StudioTemplate.SCOPE_OFFICIAL, "u9", StudioTemplate.STATUS_ACTIVE);
        when(operators.isOperatorUserId(USER)).thenReturn(false);
        assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(() -> svc.withdraw(USER, "vst_o")));
        assertEquals(StudioTemplate.STATUS_ACTIVE, official.getStatus());
        when(operators.isOperatorUserId(USER)).thenReturn(true);
        svc.withdraw(USER, "vst_o");
        assertEquals(StudioTemplate.STATUS_WITHDRAWN, official.getStatus());

        stored("vst_p", StudioTemplate.SCOPE_PRIVATE, "u9", StudioTemplate.STATUS_ACTIVE);
        assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(() -> svc.withdraw(USER, "vst_p")), "运营也不能删别人的私有模板");
        assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(() -> svc.withdraw(USER, "vst_m")), "已下架的再删 → 404");
        assertEquals("VIDEO_STUDIO_TEMPLATE_NOT_FOUND", code(() -> svc.withdraw(USER, null)));
    }

    @Test
    @DisplayName("做同款的素材表：key → 类型；计数走单条自增")
    void materialTypesAndUseCount() throws Exception {
        var recipe = new VideoStudioTemplateService.TemplateRecipe("first_last_frame_video", "p", "768p", "9:16", 5, null,
                null, null, List.of(
                new VideoStudioTemplateService.TemplateRecipe.Material("first_frame", "image", "k1", "首帧"),
                new VideoStudioTemplateService.TemplateRecipe.Material("last_frame", "image", "k2", "尾帧")));
        StudioTemplate t = StudioTemplate.builder().id("vst_x").recipeJson(om.writeValueAsString(recipe)).build();
        assertEquals(Map.of("k1", "image", "k2", "image"), svc.materialTypes(t));

        svc.countUse("vst_x");
        verify(repo).incrementUseCount("vst_x");
    }
}
