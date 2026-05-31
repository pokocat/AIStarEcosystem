package com.aistareco.aep.aiavatar.repository;

import com.aistareco.aep.aiavatar.model.AiAvatarLicenseGrant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AiAvatarLicenseGrantRepository extends JpaRepository<AiAvatarLicenseGrant, String> {

    List<AiAvatarLicenseGrant> findByAvatarIdOrderByCreatedAtDesc(String avatarId);

    List<AiAvatarLicenseGrant> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);

    Optional<AiAvatarLicenseGrant> findByIdAndOwnerUserId(String id, String ownerUserId);
}
