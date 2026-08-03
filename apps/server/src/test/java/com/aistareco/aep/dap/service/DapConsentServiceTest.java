package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.model.DapCapture;
import com.aistareco.aep.dap.model.DapConsent;
import com.aistareco.aep.dap.repository.DapConsentRepository;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DapConsentServiceTest {

    private DapConsentRepository repo;
    private DapConsentService service;
    private DapCapture capture;

    @BeforeEach
    void setUp() {
        repo = mock(DapConsentRepository.class);
        when(repo.existsById(anyString())).thenReturn(false);
        when(repo.findFirstByCaptureIdAndOwnerUserIdAndAgreementVersionOrderByAcceptedAtDesc(
                anyString(), anyString(), anyString())).thenReturn(Optional.empty());
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        service = new DapConsentService(repo, new DapSupport());
        capture = DapCapture.builder().id("CAP-1").ownerUserId("u1").avatarId("DH-1")
                .status("footage_uploaded").createdAt(Instant.now()).build();
    }

    @Test
    void agreementAndAcceptedSnapshotUseSameVersionAndHash() {
        var agreement = service.agreement();
        DapConsent consent = service.accept("u1", capture, agreement.version(), true,
                "203.0.113.8", "Mobile Safari");

        assertEquals(agreement.version(), consent.getAgreementVersion());
        assertEquals(agreement.hash(), consent.getAgreementHash());
        assertEquals(agreement.scope(), consent.getScope());
        assertEquals(agreement.platforms(), consent.getPlatforms());
        assertEquals(agreement.processors(), consent.getProcessors());
        assertTrue(consent.getAgreementText().contains(agreement.title()));
        assertTrue(consent.getAgreementText().contains("七牛云 Modelink"));
        assertNotNull(consent.getAcceptedAt());
        assertEquals("203.0.113.8", consent.getClientIp());
        verify(repo).save(any(DapConsent.class));
    }

    @Test
    void startCannotSilentlyAcceptOrUseStaleAgreement() {
        BusinessException missing = assertThrows(BusinessException.class,
                () -> service.accept("u1", capture, DapConsentService.VERSION, false, null, null));
        assertEquals("DAP_CONSENT_REQUIRED", missing.getCode());

        BusinessException stale = assertThrows(BusinessException.class,
                () -> service.accept("u1", capture, "old-version", true, null, null));
        assertEquals("DAP_CONSENT_VERSION_CHANGED", stale.getCode());
        verify(repo, never()).save(any());
    }
}
