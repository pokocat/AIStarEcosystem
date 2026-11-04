package com.aistareco.aep.service.materialvideo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;

public interface MaterialVideoInputAssetRepository extends JpaRepository<MaterialVideoInputAsset, String>, MaterialVideoInputAssetWriter {
    // Scalar reads avoid a stale managed entity after a native upsert in this same transaction.
    @Query("select a.assetId, a.expiresAt from MaterialVideoInputAsset a where a.id = :id")
    List<Object[]> receipt(@Param("id") String id);

}
