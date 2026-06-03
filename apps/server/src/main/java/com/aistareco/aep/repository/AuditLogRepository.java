package com.aistareco.aep.repository;

import com.aistareco.aep.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

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

    /**
     * v0.47：登录注册日志多维过滤入口。action 用 IN（actions 非空时）；
     * username / ipAddress 走 LIKE 前缀；since / until 两端可选。
     */
    @Query("""
            SELECT a FROM AuditLog a
            WHERE (:actions IS NULL OR a.action IN :actions)
              AND (:userId IS NULL OR a.userId = :userId)
              AND (:username IS NULL OR a.username LIKE CONCAT(:username, '%'))
              AND (:ipAddress IS NULL OR a.ipAddress LIKE CONCAT(:ipAddress, '%'))
              AND (:result IS NULL OR a.result = :result)
              AND (:errorCode IS NULL OR a.errorCode = :errorCode)
              AND (:since IS NULL OR a.createdAt >= :since)
              AND (:until IS NULL OR a.createdAt <= :until)
            """)
    Page<AuditLog> search(@Param("actions") List<String> actions,
                          @Param("userId") String userId,
                          @Param("username") String username,
                          @Param("ipAddress") String ipAddress,
                          @Param("result") AuditLog.AuditResult result,
                          @Param("errorCode") String errorCode,
                          @Param("since") Instant since,
                          @Param("until") Instant until,
                          Pageable pageable);
}
