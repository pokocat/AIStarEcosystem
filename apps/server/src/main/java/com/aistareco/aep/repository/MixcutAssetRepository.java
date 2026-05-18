package com.aistareco.aep.repository;

import com.aistareco.aep.model.MixcutAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MixcutAssetRepository extends JpaRepository<MixcutAsset, String> {
    List<MixcutAsset> findAllByOrderByUploadedAtDesc();
    List<MixcutAsset> findByKindOrderByUploadedAtDesc(String kind);
    List<MixcutAsset> findByUserIdOrderByUploadedAtDesc(String userId);
    List<MixcutAsset> findByUserIdAndKindOrderByUploadedAtDesc(String userId, String kind);
}
