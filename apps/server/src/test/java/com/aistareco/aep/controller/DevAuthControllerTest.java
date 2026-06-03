package com.aistareco.aep.controller;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.common.ApiResponse;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DevAuthControllerTest {

    @Test
    void listDevAccountsToleratesIncompleteStudioRows() {
        AepUser goodUser = AepUser.builder()
                .id("u1")
                .username("studio_starlight")
                .displayName("")
                .kind(AepUser.AccountKind.STUDIO)
                .status(AepUser.UserStatus.ACTIVE)
                .build();
        AepUser malformedUser = AepUser.builder()
                .id("u2")
                .username("")
                .kind(AepUser.AccountKind.STUDIO)
                .status(AepUser.UserStatus.ACTIVE)
                .build();
        Studio incompleteStudio = Studio.builder()
                .id("s1")
                .ownerUserId("u1")
                .name(null)
                .kind(null)
                .build();

        AepUserRepository userRepo = mock(AepUserRepository.class);
        StudioRepository studioRepo = mock(StudioRepository.class);
        when(userRepo.findAll()).thenReturn(List.of(malformedUser, goodUser));
        when(studioRepo.findByOwnerUserId("u1")).thenReturn(Optional.of(incompleteStudio));

        // v0.47：DevAuthController 注入 AuditService（IP/UA 落审计日志）。
        // 该用例只跑 listDevAccounts() 不触发审计写入 → 用 mock 但不 stub 即可。
        com.aistareco.aep.service.AuditService auditService =
                mock(com.aistareco.aep.service.AuditService.class);
        DevAuthController controller = new DevAuthController(userRepo, studioRepo, null, auditService);

        ApiResponse<List<Map<String, Object>>> response = controller.listDevAccounts();

        assertThat(response.data()).hasSize(1);
        Map<String, Object> row = response.data().get(0);
        assertThat(row)
                .containsEntry("username", "studio_starlight")
                .containsEntry("displayName", "studio_starlight")
                .containsEntry("studioName", "")
                .containsEntry("studioKind", "");
    }
}
