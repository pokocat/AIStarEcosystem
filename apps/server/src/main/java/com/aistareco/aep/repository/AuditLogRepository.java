package com.aistareco.aep.repository;

import com.aistareco.aep.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, String>,
        PagingAndSortingRepository<AuditLog, String> {

    Page<AuditLog> findByUserId(String userId, Pageable pageable);

    Page<AuditLog> findByAction(String action, Pageable pageable);

    Page<AuditLog> findByResult(AuditLog.AuditResult result, Pageable pageable);

    Page<AuditLog> findByUserIdAndAction(String userId, String action, Pageable pageable);

    Page<AuditLog> findByUserIdAndResult(String userId, AuditLog.AuditResult result, Pageable pageable);

    Page<AuditLog> findByActionAndResult(String action, AuditLog.AuditResult result, Pageable pageable);

    Page<AuditLog> findByUserIdAndActionAndResult(String userId, String action, AuditLog.AuditResult result, Pageable pageable);
}
