package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapPublicAvatar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DapPublicAvatarRepository extends JpaRepository<DapPublicAvatar, String> {
    List<DapPublicAvatar> findAllByOrderBySortOrderAscCreatedAtDesc();

    @org.springframework.data.jpa.repository.Query("select a from DapPublicAvatar a where a.frontKey = :key or a.rightKey = :key or a.leftKey = :key")
    List<DapPublicAvatar> findByImageKey(@org.springframework.data.repository.query.Param("key") String key);
}
