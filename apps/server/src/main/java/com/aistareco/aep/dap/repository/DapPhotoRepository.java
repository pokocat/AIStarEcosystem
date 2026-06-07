package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapPhoto;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DapPhotoRepository extends JpaRepository<DapPhoto, String> {
    List<DapPhoto> findByAvatarIdOrderByCreatedAtAsc(String avatarId);
    @Query("SELECT COALESCE(SUM(p.bytes),0) FROM DapPhoto p WHERE p.ownerUserId = :uid")
    long sumBytesByOwner(@Param("uid") String uid);
}
