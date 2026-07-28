package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapStyle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapStyleRepository extends JpaRepository<DapStyle, String> {
    List<DapStyle> findByOwnerUserIdAndDeletedAtIsNullOrderByUseCountDescUpdatedAtDesc(String ownerUserId);
    Optional<DapStyle> findByIdAndOwnerUserId(String id, String ownerUserId);
    long countByOwnerUserIdAndDeletedAtIsNull(String ownerUserId);
}
