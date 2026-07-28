package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapCompositionOutput;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface DapCompositionOutputRepository extends JpaRepository<DapCompositionOutput, String> {
    List<DapCompositionOutput> findByCompositionIdOrderByIdxAsc(String compositionId);

    @Transactional
    void deleteByCompositionId(String compositionId);

    @Query("SELECT COALESCE(SUM(o.bytes),0) FROM DapCompositionOutput o WHERE o.ownerUserId = :uid")
    long sumBytesByOwner(@Param("uid") String uid);
}
