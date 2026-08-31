package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapJob;
import com.aistareco.aep.dap.repository.DapDerivativeRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 定稿后自动待机循环（设计文档 §1.5）：
 * 不计费 / 不重复建单 / 任何失败都不得抛给定稿调用方 / 开关可关。
 */
class DapAutoIdleLoopTest {

    private static final String USER = "u1";
    private static final String AVATAR = "DH-1";

    private DapAvatarService avatarService;
    private DapJobService jobService;
    private DapMaterialService materialService;
    private DapMultimodalClient multimodal;
    private DapProperties props;
    private DapWorkflowService workflow;

    private DapAvatar avatar(String path, String videoState) {
        DapAvatar a = new DapAvatar();
        a.setId(AVATAR);
        a.setOwnerUserId(USER);
        a.setPath(path);
        a.setImageKey("k/hero.png");
        a.setStatus("finalized");
        Map<String, Object> deriv = new HashMap<>();
        if (videoState != null) deriv.put("video", videoState);
        a.setDeriv(deriv);
        return a;
    }

    @BeforeEach
    void setUp() {
        avatarService = mock(DapAvatarService.class);
        jobService = mock(DapJobService.class);
        materialService = mock(DapMaterialService.class);
        multimodal = mock(DapMultimodalClient.class);
        props = new DapProperties();
        when(multimodal.isConfigured()).thenReturn(true);
        when(jobService.submit(any(), any(), any(), any(), any(), anyLong(), any(), any()))
                .thenReturn(DapJob.builder().id("J-1").build());
        workflow = new DapWorkflowService(avatarService, jobService, mock(DapLicenseService.class),
                materialService, mock(DapLookRepository.class), mock(DapDerivativeRepository.class),
                mock(DapCatalogService.class), mock(DapSupport.class), mock(FileStorageService.class),
                multimodal, props);
    }

    @Test
    void queuesFreeIdleLoopForAiAvatar() {
        when(avatarService.required(USER, AVATAR)).thenReturn(avatar("ai", null));

        workflow.autoIdleLoopAfterFinalize(USER, AVATAR);

        // 关键：cost 必须是 0 —— 系统发起，不能悄悄扣用户的点
        verify(jobService).submit(eq(USER), any(), eq(DapJob.T_DERIVE), eq("待机循环"), any(), eq(0L), any(), any());
    }

    @Test
    void skipsWhenVideoDerivAlreadyPresent() {
        when(avatarService.required(USER, AVATAR)).thenReturn(avatar("ai", "done"));
        workflow.autoIdleLoopAfterFinalize(USER, AVATAR);
        verifyNoInteractions(jobService);
    }

    @Test
    void skipsWhenAlreadyRunning() {
        when(avatarService.required(USER, AVATAR)).thenReturn(avatar("ai", "running"));
        workflow.autoIdleLoopAfterFinalize(USER, AVATAR);
        verifyNoInteractions(jobService);
    }

    @Test
    void skipsWhenSwitchedOff() {
        props.setAutoIdleLoop(false);
        workflow.autoIdleLoopAfterFinalize(USER, AVATAR);
        verifyNoInteractions(avatarService, jobService);
    }

    @Test
    void realAvatarWithoutApprovedMaterialIsSkippedNotThrown() {
        when(avatarService.required(USER, AVATAR)).thenReturn(avatar("real", null));
        when(materialService.requireApprovedGenerationAsset(eq(USER), eq(AVATAR), any()))
                .thenThrow(new BusinessException(HttpStatus.BAD_REQUEST, "DAP_NO_MATERIAL", "缺素材"));

        assertDoesNotThrow(() -> workflow.autoIdleLoopAfterFinalize(USER, AVATAR));
        verifyNoInteractions(jobService);
    }

    @Test
    void jobSubmitFailureNeverPropagates() {
        when(avatarService.required(USER, AVATAR)).thenReturn(avatar("ai", null));
        when(jobService.submit(any(), any(), any(), any(), any(), anyLong(), any(), any()))
                .thenThrow(new IllegalStateException("engine down"));

        // 定稿已经成功，这里失败只能记日志，不能抛回调用方
        assertDoesNotThrow(() -> workflow.autoIdleLoopAfterFinalize(USER, AVATAR));
    }
}
