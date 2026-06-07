package com.aistareco.aep.repository;

import com.aistareco.aep.model.LedgerEntry;
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
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, String>,
        PagingAndSortingRepository<LedgerEntry, String> {

    Page<LedgerEntry> findByWalletId(String walletId, Pageable pageable);

    /** v0.51 dap：月度赠送幂等检查（referenceId = userId:yyyyMM）。 */
    boolean existsByReferenceTypeAndReferenceId(String referenceType, String referenceId);

    Page<LedgerEntry> findByUserId(String userId, Pageable pageable);

    List<LedgerEntry> findByUserIdOrderByCreatedAtDesc(String userId);

    /**
     * Sum of all positive credits ever issued (license grants + recharges + gifts + income + refunds + adjusts).
     * Used by admin stats dashboards.
     */
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM LedgerEntry e WHERE e.amount > 0")
    long sumTotalCreditsIssued();

    /**
     * 拉取某用户自 since 起的所有入账条目（amount &gt; 0），留给 Service 层做月度 / 来源分桶。
     * 避免数据库方言差异（H2 / MySQL / PostgreSQL 日期函数不一致）。
     */
    @Query("SELECT e FROM LedgerEntry e " +
            "WHERE e.userId = :userId AND e.amount > 0 AND e.createdAt >= :since " +
            "ORDER BY e.createdAt ASC")
    List<LedgerEntry> findPositiveSince(@Param("userId") String userId,
                                         @Param("since") Instant since);

    /**
     * 按 entryType 分桶的入账总额（全期），用于饼图聚合。仍走 JPQL 因 entryType 是枚举列，
     * 各方言均支持枚举 GROUP BY。
     */
    @Query("SELECT e.entryType, COALESCE(SUM(e.amount), 0) " +
            "FROM LedgerEntry e " +
            "WHERE e.userId = :userId AND e.amount > 0 " +
            "GROUP BY e.entryType")
    List<Object[]> aggregateIncomeByType(@Param("userId") String userId);

    /**
     * 平台级：自 since 起的所有入账条目（amount &gt; 0），留给 Service 层做月度分桶。
     * 用于 admin 财务图表。
     */
    @Query("SELECT e FROM LedgerEntry e " +
            "WHERE e.amount > 0 AND e.createdAt >= :since " +
            "ORDER BY e.createdAt ASC")
    List<LedgerEntry> findAllPositiveSince(@Param("since") Instant since);

    /**
     * 平台级：按 entryType 分桶的入账总额（全期），用于饼图聚合。
     */
    @Query("SELECT e.entryType, COALESCE(SUM(e.amount), 0) " +
            "FROM LedgerEntry e " +
            "WHERE e.amount > 0 " +
            "GROUP BY e.entryType")
    List<Object[]> aggregateIncomeByTypeAll();
}
