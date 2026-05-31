package com.aistareco.aep.aiavatar.repository;

import com.aistareco.aep.aiavatar.model.AiAvatarVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiAvatarVersionRepository extends JpaRepository<AiAvatarVersion, String> {

    List<AiAvatarVersion> findByAvatarIdOrderByVersionNoAsc(String avatarId);

    List<AiAvatarVersion> findByAvatarIdAndOwnerUserIdOrderByVersionNoAsc(String avatarId, String ownerUserId);

    Optional<AiAvatarVersion> findByIdAndOwnerUserId(String id, String ownerUserId);

    Optional<AiAvatarVersion> findTopByAvatarIdOrderByVersionNoDesc(String avatarId);

    long countByAvatarId(String avatarId);
}
