package com.aistareco.aep.repository;

import com.aistareco.aep.model.MixcutAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MixcutAssetRepository extends JpaRepository<MixcutAsset, String> {
    List<MixcutAsset> findByDeletedAtIsNullOrderByUploadedAtDesc();
    List<MixcutAsset> findByKindAndDeletedAtIsNullOrderByUploadedAtDesc(String kind);
    List<MixcutAsset> findByUserIdAndDeletedAtIsNullOrderByUploadedAtDesc(String userId);
    List<MixcutAsset> findByUserIdAndKindAndDeletedAtIsNullOrderByUploadedAtDesc(String userId, String kind);

    // v0.13+: preset 池
    List<MixcutAsset> findByIsPresetTrueAndDeletedAtIsNullOrderByPresetGroupAscNameAsc();
    List<MixcutAsset> findByIsPresetTrueAndKindAndDeletedAtIsNullOrderByPresetGroupAscNameAsc(String kind);
    List<MixcutAsset> findByIsPresetTrueAndPresetGroupAndDeletedAtIsNullOrderByNameAsc(String presetGroup);
    List<MixcutAsset> findByIsPresetTrueAndKindAndPresetGroupAndDeletedAtIsNullOrderByNameAsc(String kind, String presetGroup);

    /** preset 全用户可见 + 用户私有，合并为一个列表（控制器调用层用 distinct + sort）。 */
    Optional<MixcutAsset> findFirstByIsPresetTrueAndPresetGroupAndNameAndDeletedAtIsNullOrderByUploadedAtAsc(String presetGroup, String name);

    // v0.21+: 官方明星片段（运营上传，用户只读消费）
    List<MixcutAsset> findByIsOfficialTrueAndDeletedAtIsNullOrderByUploadedAtDesc();
    List<MixcutAsset> findByIsOfficialTrueAndOfficialCategoryAndDeletedAtIsNullOrderByUploadedAtDesc(String officialCategory);
    List<MixcutAsset> findByIsOfficialTrueAndRelatedStarIdAndDeletedAtIsNullOrderByUploadedAtDesc(String relatedStarId);
    List<MixcutAsset> findByIsOfficialTrueAndOfficialCategoryAndRelatedStarIdAndDeletedAtIsNullOrderByUploadedAtDesc(String officialCategory, String relatedStarId);

    // v0.26+: 商品关联素材（按 product 过滤；混剪 create 页「本商品素材」chip 用）
    List<MixcutAsset> findByRelatedProductIdAndDeletedAtIsNullOrderByUploadedAtDesc(String relatedProductId);
    List<MixcutAsset> findByRelatedProductIdAndKindAndDeletedAtIsNullOrderByUploadedAtDesc(String relatedProductId, String kind);
    List<MixcutAsset> findByUserIdAndRelatedProductIdAndDeletedAtIsNullOrderByUploadedAtDesc(String userId, String relatedProductId);
}
