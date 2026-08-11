package com.aistareco.aep.clip.repository;
import com.aistareco.aep.clip.model.ClipAsset;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ClipAssetRepository extends JpaRepository<ClipAsset, String> {
    Optional<ClipAsset> findByIdAndExternalOwnerIdAndDeletedAtIsNull(String id, String owner);
    List<ClipAsset> findByExternalOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(String owner);
    List<ClipAsset> findByPresetTrueAndDeletedAtIsNullOrderByCreatedAtDesc();
}
