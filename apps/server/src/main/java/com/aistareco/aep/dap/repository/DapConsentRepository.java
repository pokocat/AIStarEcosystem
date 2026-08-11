package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapConsent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface DapConsentRepository extends JpaRepository<DapConsent, String> {
    Optional<DapConsent> findByIdAndOwnerUserId(String id, String ownerUserId);
    Optional<DapConsent> findFirstByCaptureIdAndOwnerUserIdAndAgreementVersionOrderByAcceptedAtDesc(
            String captureId, String ownerUserId, String agreementVersion);
    Optional<DapConsent> findFirstByOwnerUserIdOrderByAcceptedAtDesc(String ownerUserId);
    java.util.List<DapConsent> findByOwnerUserIdOrderByAcceptedAtDesc(String ownerUserId);
}
