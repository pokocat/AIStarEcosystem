package com.aistareco.aep.repository;

import com.aistareco.aep.model.MixcutAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MixcutAssetRepository extends JpaRepository<MixcutAsset, String> {
    List<MixcutAsset> findAllByOrderByUploadedAtDesc();
    List<MixcutAsset> findByKindOrderByUploadedAtDesc(String kind);
    List<MixcutAsset> findByUserIdOrderByUploadedAtDesc(String userId);
    List<MixcutAsset> findByUserIdAndKindOrderByUploadedAtDesc(String userId, String kind);

    // v0.13+: preset 池
    List<MixcutAsset> findByIsPresetTrueOrderByPresetGroupAscNameAsc();
    List<MixcutAsset> findByIsPresetTrueAndKindOrderByPresetGroupAscNameAsc(String kind);
    List<MixcutAsset> findByIsPresetTrueAndPresetGroupOrderByNameAsc(String presetGroup);
    List<MixcutAsset> findByIsPresetTrueAndKindAndPresetGroupOrderByNameAsc(String kind, String presetGroup);

    /** preset 全用户可见 + 用户私有，合并为一个列表（控制器调用层用 distinct + sort）。 */
    Optional<MixcutAsset> findFirstByIsPresetTrueAndPresetGroupAndNameOrderByUploadedAtAsc(String presetGroup, String name);

    // v0.21+: 官方明星片段（运营上传，用户只读消费）
    List<MixcutAsset> findByIsOfficialTrueOrderByUploadedAtDesc();
    List<MixcutAsset> findByIsOfficialTrueAndOfficialCategoryOrderByUploadedAtDesc(String officialCategory);
    List<MixcutAsset> findByIsOfficialTrueAndRelatedStarIdOrderByUploadedAtDesc(String relatedStarId);
    List<MixcutAsset> findByIsOfficialTrueAndOfficialCategoryAndRelatedStarIdOrderByUploadedAtDesc(String officialCategory, String relatedStarId);
}
