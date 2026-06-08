package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapAvatarVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapAvatarVersionRepository extends JpaRepository<DapAvatarVersion, String> {
    List<DapAvatarVersion> findByAvatarIdOrderByVDesc(String avatarId);
    Optional<DapAvatarVersion> findByAvatarIdAndV(String avatarId, int v);
}
