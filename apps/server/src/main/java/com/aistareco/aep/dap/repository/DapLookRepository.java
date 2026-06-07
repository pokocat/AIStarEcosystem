package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapLook;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DapLookRepository extends JpaRepository<DapLook, String> {
    List<DapLook> findByAvatarIdOrderByCreatedAtDesc(String avatarId);
    @Query("SELECT COALESCE(SUM(l.bytes),0) FROM DapLook l WHERE l.ownerUserId = :uid")
    long sumBytesByOwner(@Param("uid") String uid);
}
