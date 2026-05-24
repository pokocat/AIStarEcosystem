package com.aistareco.aep.repository;

import com.aistareco.aep.model.ErrorLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface ErrorLogRepository extends JpaRepository<ErrorLog, String> {

    Optional<ErrorLog> findByLogId(String logId);

    /**
     * 组合过滤：所有参数都 nullable，传 null 即不参与过滤。
     * 单 query 替代「8 种排列组合 if-else 链」（AuditService 的旧写法），更易维护。
     */
    @Query(
            "select e from ErrorLog e " +
                    "where (:userId is null or e.userId = :userId) " +
                    "and (:endpoint is null or e.endpoint like concat('%', :endpoint, '%')) " +
                    "and (:httpStatus is null or e.httpStatus = :httpStatus) " +
                    "and (:hostname is null or e.hostname = :hostname) " +
                    "and (:since is null or e.occurredAt >= :since) " +
                    "and (:until is null or e.occurredAt <= :until)"
    )
    Page<ErrorLog> search(
            @Param("userId") String userId,
            @Param("endpoint") String endpoint,
            @Param("httpStatus") Integer httpStatus,
            @Param("hostname") String hostname,
            @Param("since") Instant since,
            @Param("until") Instant until,
            Pageable pageable
    );
}
