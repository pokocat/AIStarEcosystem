package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapPublicAvatar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DapPublicAvatarRepository extends JpaRepository<DapPublicAvatar, String> {
    List<DapPublicAvatar> findAllByOrderBySortOrderAscCreatedAtDesc();

    @org.springframework.data.jpa.repository.Query("select a from DapPublicAvatar a where a.frontKey = :key or a.rightKey = :key or a.leftKey = :key or a.threeViewKey = :key")
    List<DapPublicAvatar> findByImageKey(@org.springframework.data.repository.query.Param("key") String key);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("update DapPublicAvatar a set a.threeViewKey = :key where a.id = :id and a.threeViewKey is null")
    int setBuiltinThreeViewIfMissing(@org.springframework.data.repository.query.Param("id") String id,
                                    @org.springframework.data.repository.query.Param("key") String key);
}
