package com.aistareco.aep.repository;

import com.aistareco.aep.model.LedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    // ── v2 §1/§4.2 两平面 plane 列：回填 + §11 对账聚合 ────────────────────────────

    /**
     * 仍待回填的行里，实际出现过哪些 entry_type（native，返回字符串名）。用 native 避免 Hibernate 把
     * 参数/列按枚举绑定 —— 老库 / 持久化 H2 的 {@code entry_type} 原生 ENUM 列可能尚未 widen 到含新值
     * （如 REFUND_CASH），JPQL 的 {@code IN (:types)} 会被 H2 拒（即便只是比较）。只取库里真实存在的值，
     * 天然规避，且对任何未来新增枚举值都健壮。
     */
    @Query(value = "SELECT DISTINCT entry_type FROM aep_ledger_entries WHERE plane IS NULL", nativeQuery = true)
    List<String> distinctEntryTypesWithNullPlane();

    /**
     * 历史行 plane 回填（v2 §4.2）：老库 / 持久化 H2 加列后 plane 为 null（{@code @PrePersist} 只在
     * insert 触发，不动既有行）。按单个 entry_type 字符串回填，native + 幂等（只动 plane IS NULL）。
     * 返回受影响行数。
     */
    @Modifying(clearAutomatically = true)
    @Query(value = "UPDATE aep_ledger_entries SET plane = :plane WHERE plane IS NULL AND entry_type = :type",
            nativeQuery = true)
    int backfillPlaneForType(@Param("plane") String plane, @Param("type") String type);

    /** 仍有多少行 plane 未回填（启动自检 / 对账前置）。 */
    long countByPlaneIsNull();

    /**
     * v2 §11 对账：按 entryType 汇总带符号金额（amount 已带符号：充值正 / 提现退款负）。
     * 资金面 = RECHARGE/REFUND_CASH/WITHDRAW；积分面负债 = GIFT/ADJUST/LICENSE_GRANT。
     * 调用方按需挑 entryType；shadow 排除由 Service 层基于 RechargeOrder.paidVia 处理。
     */
    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM LedgerEntry e WHERE e.entryType = :type")
    long sumAmountByType(@Param("type") LedgerEntry.LedgerEntryType type);
}
