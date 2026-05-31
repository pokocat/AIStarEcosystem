package com.aistareco.aep.aiavatar.repository;

import com.aistareco.aep.aiavatar.model.AiAvatarAsset;
import com.aistareco.aep.aiavatar.model.AiAvatarAssetKind;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiAvatarAssetRepository extends JpaRepository<AiAvatarAsset, String> {

    List<AiAvatarAsset> findByAvatarIdOrderByCreatedAtDesc(String avatarId);

    List<AiAvatarAsset> findByVersionIdOrderByCreatedAtAsc(String versionId);

    List<AiAvatarAsset> findByAvatarIdAndKindOrderByCreatedAtDesc(String avatarId, AiAvatarAssetKind kind);

    Optional<AiAvatarAsset> findByIdAndOwnerUserId(String id, String ownerUserId);

    List<AiAvatarAsset> findByOwnerUserIdAndAvatarIdIsNullOrderByCreatedAtDesc(String ownerUserId);
}
