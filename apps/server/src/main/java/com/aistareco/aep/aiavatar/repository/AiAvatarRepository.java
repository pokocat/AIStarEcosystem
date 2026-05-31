package com.aistareco.aep.aiavatar.repository;

import com.aistareco.aep.aiavatar.model.AiAvatar;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiAvatarRepository extends JpaRepository<AiAvatar, String> {

    List<AiAvatar> findByOwnerUserIdOrderByUpdatedAtDesc(String ownerUserId);

    Optional<AiAvatar> findByIdAndOwnerUserId(String id, String ownerUserId);

    long countByOwnerUserId(String ownerUserId);
}
