package com.aistareco.aep.aiavatar.repository;

import com.aistareco.aep.aiavatar.model.AiAvatarRefineEdit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface AiAvatarRefineEditRepository extends JpaRepository<AiAvatarRefineEdit, String> {

    List<AiAvatarRefineEdit> findByAvatarIdOrderByCreatedAtDesc(String avatarId);

    List<AiAvatarRefineEdit> findByAvatarIdAndOwnerUserIdOrderByCreatedAtDesc(String avatarId, String ownerUserId);
}
