package com.aistareco.aep.videostudio;

import com.aistareco.aep.videostudio.controller.VideoStudioController;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJobRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimizationRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplateCreateRequest;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationService;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.aep.videostudio.service.VideoStudioTemplateService;
import com.aistareco.aep.videostudio.service.VideoStudioUploadService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RequestMapping;

import java.security.Principal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/** 路由挂在 /api/me/celebrity/**（开通闸按 celebrity 判）；没有登录身份一律 401，不往下走。 */
class VideoStudioControllerTest {

    private final VideoStudioService studio = mock(VideoStudioService.class);
    private final VideoStudioUploadService uploads = mock(VideoStudioUploadService.class);
    private final VideoStudioOptimizationService optimizations = mock(VideoStudioOptimizationService.class);
    private final VideoStudioTemplateService templates = mock(VideoStudioTemplateService.class);
    private final VideoStudioController controller =
            new VideoStudioController(studio, uploads, optimizations, templates);
    private final Principal alice = () -> "u1";

    @Test
    void mountedUnderCelebrityMe() {
        assertEquals(List.of("/api/me/celebrity/video-studio"),
                List.of(VideoStudioController.class.getAnnotation(RequestMapping.class).value()));
    }

    @Test
    @DisplayName("没有登录身份 → 401 UNAUTHORIZED，服务一个都不调")
    void anonymousIsRejected() {
        for (Runnable call : List.<Runnable>of(
                () -> controller.models(null),
                () -> controller.upload(null, null, "image"),
                () -> controller.submit(null, null),
                () -> controller.jobs(null),
                () -> controller.job(null, "mvj_1"),
                () -> controller.jobs(() -> " "),
                () -> controller.optimize(null, null),
                () -> controller.optimization(null, "vso_1"),
                () -> controller.templates(null),
                () -> controller.template(null, "vst_1"),
                () -> controller.saveTemplate(null, null),
                () -> controller.withdrawTemplate(null, "vst_1"))) {
            BusinessException e = assertThrows(BusinessException.class, call::run);
            assertEquals("UNAUTHORIZED", e.getCode());
            assertEquals(HttpStatus.UNAUTHORIZED, e.getStatus());
        }
        verify(studio, never()).submit(any(), any());
        verify(studio, never()).listJobs(any());
        verify(optimizations, never()).create(any(), any());
        verify(templates, never()).withdraw(any(), any());
    }

    @Test
    @DisplayName("用登录身份的 uid 调服务；删除模板回 204")
    void delegatesWithPrincipalName() {
        VideoStudioJobRequest req = new VideoStudioJobRequest(null, "t2v", "p", "768p", "9:16", 5, null, null, null,
                null, null, null);
        controller.submit(alice, req);
        controller.jobs(alice);
        controller.job(alice, "mvj_1");
        controller.upload(alice, null, "audio");
        verify(studio).submit("u1", req);
        verify(studio).listJobs("u1");
        verify(studio).getJob("u1", "mvj_1");
        verify(uploads).upload("u1", null, "audio");

        VideoStudioOptimizationRequest opt = new VideoStudioOptimizationRequest("crid-0001", null, "t2v", "p", "768p",
                "9:16", 5, null, null, null, null);
        controller.optimize(alice, opt);
        controller.optimization(alice, "vso_1");
        verify(optimizations).create("u1", opt);
        verify(optimizations).get("u1", "vso_1");

        VideoStudioTemplateCreateRequest create = new VideoStudioTemplateCreateRequest("mvj_1", "t", null, false);
        controller.saveTemplate(alice, create);
        controller.templates(alice);
        controller.template(alice, "vst_1");
        assertEquals(204, controller.withdrawTemplate(alice, "vst_1").getStatusCode().value());
        verify(templates).create("u1", create);
        verify(templates).list("u1");
        verify(templates).get("u1", "vst_1");
        verify(templates).withdraw("u1", "vst_1");
    }
}
