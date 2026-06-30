package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaAssetRepository extends JpaRepository<DramaAsset, String> {

    List<DramaAsset> findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerUserId);

    Optional<DramaAsset> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);
}
