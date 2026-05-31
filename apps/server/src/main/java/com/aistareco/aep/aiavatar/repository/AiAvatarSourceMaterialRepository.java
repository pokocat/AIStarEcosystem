package com.aistareco.aep.aiavatar.repository;

import com.aistareco.aep.aiavatar.model.AiAvatarSourceMaterial;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiAvatarSourceMaterialRepository extends JpaRepository<AiAvatarSourceMaterial, String> {

    List<AiAvatarSourceMaterial> findByAvatarIdOrderByCreatedAtAsc(String avatarId);

    List<AiAvatarSourceMaterial> findByAvatarIdAndOwnerUserIdOrderByCreatedAtAsc(String avatarId, String ownerUserId);
}
