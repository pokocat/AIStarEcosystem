package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapAvatar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapAvatarRepository extends JpaRepository<DapAvatar, String> {
    List<DapAvatar> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);
    Optional<DapAvatar> findByIdAndOwnerUserId(String id, String ownerUserId);
}
