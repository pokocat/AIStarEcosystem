package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapProductRepository extends JpaRepository<DapProduct, String> {
    List<DapProduct> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);
    List<DapProduct> findByOwnerUserIdAndIpIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId, String ipId);
    Optional<DapProduct> findByIdAndOwnerUserId(String id, String ownerUserId);
    long countByOwnerUserIdAndDeletedAtIsNull(String ownerUserId);
    long countByOwnerUserIdAndIpIdAndDeletedAtIsNull(String ownerUserId, String ipId);

    @Query("SELECT COALESCE(SUM(p.bytes),0) FROM DapProduct p WHERE p.ownerUserId = :uid AND p.deletedAt IS NULL")
    long sumBytesByOwner(@Param("uid") String uid);
}
