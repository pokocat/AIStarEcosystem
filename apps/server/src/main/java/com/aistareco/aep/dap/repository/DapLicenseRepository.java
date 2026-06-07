package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapLicense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapLicenseRepository extends JpaRepository<DapLicense, String> {
    List<DapLicense> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);
    Optional<DapLicense> findByIdAndOwnerUserId(String id, String ownerUserId);
    Optional<DapLicense> findFirstByAvatarIdAndOwnerUserId(String avatarId, String ownerUserId);
    List<DapLicense> findByAvatarId(String avatarId);
}
