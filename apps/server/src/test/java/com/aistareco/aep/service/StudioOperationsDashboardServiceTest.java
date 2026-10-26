package com.aistareco.aep.service;

import com.aistareco.aep.controller.AdminStudioOperationsController;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.assertj.core.api.Assertions.assertThat;

class StudioOperationsDashboardServiceTest {
    @Test
    void masksEveryPhoneInsideFreeText() {
        assertThat(StudioOperationsDashboardService.masked("受益人 13812345678，发放人 18687654321"))
                .isEqualTo("受益人 138****5678，发放人 186****4321");
    }

    @Test
    void keepsFailureAndOwnershipSemanticsSeparate() {
        assertThat(StudioOperationsDashboardService.failureCategory("VIDEO_TIMEOUT", "provider timeout")).isEqualTo("timeout");
        assertThat(StudioOperationsDashboardService.ownership("VIDEO_TIMEOUT", "provider timeout")).isEqualTo("供应商");
        assertThat(StudioOperationsDashboardService.ownership("INVALID_REQUEST", "bad dimensions")).isEqualTo("我方请求");
        assertThat(StudioOperationsDashboardService.ownership("FAILED", "unclassified")).isEqualTo("未知");
    }

    @Test
    void classifiesKnownStudioFunctionsWithoutTreatingEveryIpRunAsAnImage() {
        assertThat(StudioOperationsDashboardService.feature("ip-run", "director:studio-director")).isEqualTo("导演台");
        assertThat(StudioOperationsDashboardService.feature("ip-run", "studio:studio-dialogue")).isEqualTo("对话");
        assertThat(StudioOperationsDashboardService.feature("ip-run", "studio:studio-video")).isEqualTo("视频");
        assertThat(StudioOperationsDashboardService.feature("ip-run", "studio:studio-lip-sync")).isEqualTo("视频");
        assertThat(StudioOperationsDashboardService.feature("ip-run", "studio:studio-image")).isEqualTo("出图");
        assertThat(StudioOperationsDashboardService.feature("drama-run", "")).isEqualTo("短剧");
        assertThat(StudioOperationsDashboardService.feature("ip-run", "studio:studio-audio")).isEqualTo("其他");
        assertThat(StudioOperationsDashboardService.feature("ip-run", "studio:studio-text")).isEqualTo("其他");
        assertThat(StudioOperationsDashboardService.feature("ip-run", "studio:studio-adopt")).isEqualTo("其他");
    }

    @Test
    void controllerRequiresAnAdminRoleAtTheServerBoundary() {
        PreAuthorize guard = AdminStudioOperationsController.class.getAnnotation(PreAuthorize.class);
        assertThat(guard).isNotNull();
        assertThat(guard.value()).contains("SUPER_ADMIN", "OPERATOR", "FINANCE_ADMIN");
    }
}
