package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapAssetIp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapAssetIpRepository extends JpaRepository<DapAssetIp, String> {
    List<DapAssetIp> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);
    Optional<DapAssetIp> findByIdAndOwnerUserId(String id, String ownerUserId);
    long countByOwnerUserIdAndDeletedAtIsNull(String ownerUserId);
}
