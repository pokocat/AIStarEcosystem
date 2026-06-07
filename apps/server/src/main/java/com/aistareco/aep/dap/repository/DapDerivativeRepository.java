package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapDerivative;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface DapDerivativeRepository extends JpaRepository<DapDerivative, String> {
    List<DapDerivative> findByAvatarIdOrderByDerivKeyAscIdxAsc(String avatarId);
    List<DapDerivative> findByAvatarIdAndDerivKeyOrderByIdxAsc(String avatarId, String derivKey);
    @Transactional
    void deleteByAvatarIdAndDerivKey(String avatarId, String derivKey);
    @Query("SELECT COALESCE(SUM(d.bytes),0) FROM DapDerivative d WHERE d.ownerUserId = :uid AND d.kind = :kind")
    long sumBytesByOwnerAndKind(@Param("uid") String uid, @Param("kind") String kind);
}
