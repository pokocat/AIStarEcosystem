package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.dto.DapRequests.SupplementLicenseRequest;
import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapConsent;
import com.aistareco.aep.dap.model.DapLicense;
import com.aistareco.aep.dap.model.DapMaterialGroup;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapMaterialGroupRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DapLicenseSupplementServiceTest {

    @Test
    void legacyLicenseCanSupplementConsentWithoutRepeatingLiveness() {
        String user = "u1";
        DapLicense license = DapLicense.builder().id("LIC-1").ownerUserId(user).subject("周野（本人）")
                .avatarId("DH-1").status("active").verifyMethod("liveness").livenessGroupId("MG-1")
                .verificationReference("qg-1").verifiedAt(Instant.now()).photoCount(1).createdAt(Instant.now()).build();
        DapMaterialGroup group = DapMaterialGroup.builder().id("MG-1").ownerUserId(user).kind("liveness_face")
                .status("active").qgroupid("qg-1").captureId("CAP-1").callbackToken("token")
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
        DapCapture capture = DapCapture.builder().id("CAP-1").ownerUserId(user).avatarId("DH-1")
                .status("verified").createdAt(Instant.now()).build();
        DapConsent consent = DapConsent.builder().id("CONS-1").ownerUserId(user).avatarId("DH-1")
                .captureId("CAP-1").agreementVersion(DapConsentService.VERSION).agreementHash("hash")
                .scope(DapConsentService.SCOPE).periodMonths(24).acceptedAt(Instant.now()).createdAt(Instant.now()).build();

        DapLicenseService licenses = mock(DapLicenseService.class);
        DapMaterialGroupRepository groups = mock(DapMaterialGroupRepository.class);
        DapCaptureRepository captures = mock(DapCaptureRepository.class);
        DapConsentService consents = mock(DapConsentService.class);
        when(licenses.required(user, "LIC-1")).thenReturn(license);
        when(groups.findByIdAndOwnerUserId("MG-1", user)).thenReturn(Optional.of(group));
        when(captures.findByIdAndOwnerUserId("CAP-1", user)).thenReturn(Optional.of(capture));
        when(consents.accept(eq(user), eq(capture), eq(DapConsentService.VERSION), eq(true), any(), any()))
                .thenReturn(consent);
        when(licenses.get(user, "LIC-1")).thenReturn(Map.of("id", "LIC-1", "status", "active"));
        DapLicenseSupplementService service = new DapLicenseSupplementService(licenses, groups, captures, consents);

        Map<String, Object> result = service.supplement(user, "LIC-1",
                new SupplementLicenseRequest(true, DapConsentService.VERSION), "127.0.0.1", "JUnit");

        assertEquals("active", result.get("status"));
        assertEquals("CONS-1", group.getConsentId());
        verify(licenses).autoCreateForCapture(eq(user), eq("DH-1"), eq("周野"), eq(1),
                eq(consent), eq(group), eq(license.getVerifiedAt()));
    }

    @Test
    void missingActiveEvidenceRequiresFreshLiveness() {
        DapLicense license = DapLicense.builder().id("LIC-1").ownerUserId("u1").subject("本人")
                .avatarId("DH-1").status("active").verifyMethod("liveness").livenessGroupId("MG-old").build();
        DapLicenseService licenses = mock(DapLicenseService.class);
        DapMaterialGroupRepository groups = mock(DapMaterialGroupRepository.class);
        when(licenses.required("u1", "LIC-1")).thenReturn(license);
        when(groups.findByIdAndOwnerUserId("MG-old", "u1")).thenReturn(Optional.empty());
        DapLicenseSupplementService service = new DapLicenseSupplementService(licenses, groups,
                mock(DapCaptureRepository.class), mock(DapConsentService.class));

        BusinessException ex = assertThrows(BusinessException.class, () -> service.supplement("u1", "LIC-1",
                new SupplementLicenseRequest(true, DapConsentService.VERSION), null, null));
        assertEquals("DAP_LIVENESS_REAUTH_REQUIRED", ex.getCode());
    }
}
