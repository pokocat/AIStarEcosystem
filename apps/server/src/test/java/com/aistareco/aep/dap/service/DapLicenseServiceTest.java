package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapRequests.CreateLicenseRequest;
import com.aistareco.aep.dap.model.DapLicense;
import com.aistareco.aep.dap.repository.DapLicenseRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DapLicenseServiceTest {

    @Test
    void legacyLivenessWithoutConsentIsNotEffective() {
        DapLicenseRepository repo = mock(DapLicenseRepository.class);
        DapLicense legacy = DapLicense.builder().id("LIC-1").ownerUserId("u1").subject("本人")
                .status("active").verifyMethod("liveness").livenessGroupId("MG-old")
                .periodEnd(Instant.now().plusSeconds(3600)).createdAt(Instant.now()).build();
        when(repo.findByIdAndOwnerUserId("LIC-1", "u1")).thenReturn(Optional.of(legacy));
        DapLicenseService service = new DapLicenseService(repo, mock(FileStorageService.class), new DapSupport());

        assertEquals("pending", service.statusOf("u1", "LIC-1"));
        assertEquals("legacy_unconfirmed", service.get("u1", "LIC-1").get("evidenceStatus"));
        assertEquals("pending", service.get("u1", "LIC-1").get("status"));
    }

    @Test
    void declaredEndpointCannotCreateAvatarAuthorization() {
        DapLicenseService service = new DapLicenseService(mock(DapLicenseRepository.class),
                mock(FileStorageService.class), new DapSupport());
        BusinessException ex = assertThrows(BusinessException.class, () -> service.create("u1",
                new CreateLicenseRequest("本人", "DH-1", "全平台", 2, List.of("全平台"))));
        assertEquals("DAP_REAL_AUTH_REQUIRED", ex.getCode());
    }

    @Test
    void certificateV2SeparatesPlatformConsentFromQiniuEvidence() {
        DapLicenseRepository repo = mock(DapLicenseRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        DapLicense license = DapLicense.builder().id("LIC-2").ownerUserId("u1").subject("周野（本人）")
                .avatarId("DH-1").scope(DapConsentService.SCOPE).platforms(DapConsentService.PLATFORMS)
                .status("active").verifyMethod("liveness").livenessGroupId("MG-1")
                .consentId("CONS-1").agreementVersion(DapConsentService.VERSION).agreementHash("hash-1")
                .consentedAt(Instant.now()).verificationProvider("qiniu_modelink")
                .verificationReference("qgroup-1").verifiedAt(Instant.now())
                .periodStart(Instant.now()).periodEnd(Instant.now().plusSeconds(3600))
                .signedAt(Instant.now()).photoCount(2).createdAt(Instant.now()).build();
        when(repo.findByIdAndOwnerUserId("LIC-2", "u1")).thenReturn(Optional.of(license));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(storage.store(any(byte[].class), eq("dap/cert"), eq("u1"), eq("html"), anyString()))
                .thenReturn(new FileStorageService.StoredFile("cert/key.html", null, null, null, 1, "text/html"));
        when(storage.signedUrl("cert/key.html")).thenReturn("https://cdn.example/cert/key.html");
        DapLicenseService service = new DapLicenseService(repo, storage, new DapSupport());

        var result = service.certificate("u1", "LIC-2");

        var bytes = org.mockito.ArgumentCaptor.forClass(byte[].class);
        verify(storage).store(bytes.capture(), eq("dap/cert"), eq("u1"), eq("html"), anyString());
        String html = new String(bytes.getValue(), StandardCharsets.UTF_8);
        assertTrue(html.contains("平台授权确认 + 七牛云 Modelink 本人刷脸核验"));
        assertTrue(html.contains("平台记录 CONS-1 · 七牛记录 qgroup-1"));
        assertTrue(html.contains("不等同于居民身份证实名认证"));
        assertEquals(2, license.getCertificateVersion());
        assertEquals("https://cdn.example/cert/key.html", result.get("certificateUrl"));
    }
}
