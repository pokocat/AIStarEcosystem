package com.aistareco.aep.service.materialvideo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;

public interface MaterialVideoInputAssetRepository extends JpaRepository<MaterialVideoInputAsset, String> {
    // Scalar reads avoid a stale managed entity after a native upsert in this same transaction.
    @Query("select a.assetId, a.expiresAt from MaterialVideoInputAsset a where a.id = :id")
    List<Object[]> receipt(@Param("id") String id);

    // Concurrent clips can first encounter the same voice together. Atomic upsert avoids duplicate-key job failures.
    @Modifying
    @Query(value = "INSERT INTO material_video_input_asset (id, source_key, asset_id, expires_at) VALUES (:id, :source, :asset, :expiry) "
            + "ON DUPLICATE KEY UPDATE asset_id = :asset, expires_at = :expiry", nativeQuery = true)
    void remember(@Param("id") String id, @Param("source") String source, @Param("asset") String asset, @Param("expiry") Instant expiry);
}
