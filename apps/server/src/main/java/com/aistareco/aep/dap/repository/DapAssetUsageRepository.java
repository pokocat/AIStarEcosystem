package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapAssetUsage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapAssetUsageRepository extends JpaRepository<DapAssetUsage, String> {
    List<DapAssetUsage> findByOwnerUserIdAndAssetTypeAndAssetIdOrderByUpdatedAtDesc(
            String ownerUserId, String assetType, String assetId);

    Optional<DapAssetUsage> findByOwnerUserIdAndAssetTypeAndAssetIdAndUsedByTypeAndUsedById(
            String ownerUserId, String assetType, String assetId, String usedByType, String usedById);

    long countByOwnerUserIdAndAssetTypeAndAssetId(String ownerUserId, String assetType, String assetId);
}
