package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapVoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapVoiceRepository extends JpaRepository<DapVoice, String> {
    List<DapVoice> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);
    Optional<DapVoice> findByIdAndOwnerUserId(String id, String ownerUserId);
    @Query("SELECT COALESCE(SUM(v.bytes),0) FROM DapVoice v WHERE v.ownerUserId = :uid")
    long sumBytesByOwner(@Param("uid") String uid);
}
