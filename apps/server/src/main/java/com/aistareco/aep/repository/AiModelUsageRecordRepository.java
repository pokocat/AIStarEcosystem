package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiModelUsageRecord;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AiModelUsageRecordRepository extends JpaRepository<AiModelUsageRecord, String> {

    // 聚合查询返回 Object[]：[0]=分组键, [1]=分组名, [2]=调用次数, [3]=total, [4]=prompt, [5]=completion, [6]=costMicros。
    // 用 Object[] 而非构造器表达式，避开 Long → long 在 JPQL new 表达式里的拆箱兼容坑。
    // token 维度只统计成功调用（success=true）；失败调用单独由 countFailed 计数。

    @Query("""
            SELECT r.providerId, r.providerName,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0),
                   COALESCE(SUM(r.costMicros), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = true
            GROUP BY r.providerId, r.providerName
            """)
    List<Object[]> aggregateByProvider(@Param("since") Instant since);

    @Query("""
            SELECT r.model, r.model,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0),
                   COALESCE(SUM(r.costMicros), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = true
            GROUP BY r.model
            """)
    List<Object[]> aggregateByModel(@Param("since") Instant since);

    @Query("""
            SELECT r.model, r.model,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0),
                   COALESCE(SUM(r.costMicros), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = true AND r.providerId = :providerId
            GROUP BY r.model
            """)
    List<Object[]> aggregateByModelForProvider(@Param("providerId") String providerId,
                                               @Param("since") Instant since);

    /**
     * 按用途（AiModelPurpose.wire）聚合，仅成功调用。
     * providerId 为 null 时统计全局；否则仅该端点。分组键 [0]=purpose（wire）。
     */
    @Query("""
            SELECT r.purpose, r.purpose,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0),
                   COALESCE(SUM(r.costMicros), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = true
              AND (:providerId IS NULL OR r.providerId = :providerId)
            GROUP BY r.purpose
            """)
    List<Object[]> aggregateByPurpose(@Param("since") Instant since,
                                      @Param("providerId") String providerId);

    @Query("""
            SELECT r.userId, r.userId,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0),
                   COALESCE(SUM(r.costMicros), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = true
              AND (:providerId IS NULL OR r.providerId = :providerId)
            GROUP BY r.userId
            """)
    List<Object[]> aggregateByUser(@Param("since") Instant since,
                                   @Param("providerId") String providerId);

    @Query("""
            SELECT r.tenantId, r.tenantId,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0),
                   COALESCE(SUM(r.costMicros), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = true
              AND (:providerId IS NULL OR r.providerId = :providerId)
            GROUP BY r.tenantId
            """)
    List<Object[]> aggregateByTenant(@Param("since") Instant since,
                                     @Param("providerId") String providerId);

    /**
     * 按来源应用聚合。第二列返回 purpose，service 会对历史空 app_code 按用途做兜底归类。
     */
    @Query("""
            SELECT r.appCode, r.purpose,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0),
                   COALESCE(SUM(r.costMicros), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = true
              AND (:providerId IS NULL OR r.providerId = :providerId)
            GROUP BY r.appCode, r.purpose
            """)
    List<Object[]> aggregateByAppCode(@Param("since") Instant since,
                                      @Param("providerId") String providerId);

    /**
     * 时间窗内成功调用的明细行（按天分桶用，分桶在 service 侧做，避开各 DB 的日期函数方言差异）。
     * 返回 [0]=createdAt, [1]=total, [2]=prompt, [3]=completion。
     */
    @Query("""
            SELECT r.createdAt, r.totalTokens, r.promptTokens, r.completionTokens
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = true
              AND (:providerId IS NULL OR r.providerId = :providerId)
            """)
    List<Object[]> dailyRows(@Param("since") Instant since,
                             @Param("providerId") String providerId);

    @Query("""
            SELECT r
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since
              AND (:providerId IS NULL OR r.providerId = :providerId)
              AND (:userId IS NULL OR r.userId = :userId)
              AND (:tenantId IS NULL OR r.tenantId = :tenantId)
              AND (:purpose IS NULL OR r.purpose = :purpose)
              AND (:success IS NULL OR r.success = :success)
              AND (:q IS NULL OR
                    LOWER(COALESCE(r.userId, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                    LOWER(COALESCE(r.tenantId, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                    LOWER(COALESCE(r.appCode, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                    LOWER(COALESCE(r.providerName, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                    LOWER(COALESCE(r.model, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                    LOWER(COALESCE(r.purpose, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                    LOWER(COALESCE(r.requestId, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                    LOWER(COALESCE(r.upstreamId, '')) LIKE LOWER(CONCAT('%', :q, '%')) OR
                    LOWER(COALESCE(r.errorCode, '')) LIKE LOWER(CONCAT('%', :q, '%')))
            ORDER BY r.createdAt DESC
            """)
    List<AiModelUsageRecord> searchRecords(@Param("since") Instant since,
                                           @Param("providerId") String providerId,
                                           @Param("userId") String userId,
                                           @Param("tenantId") String tenantId,
                                           @Param("purpose") String purpose,
                                           @Param("success") Boolean success,
                                           @Param("q") String q,
                                           Pageable pageable);

    /** 时间窗内失败调用数（success=false）。providerId 为 null 时统计全局。 */
    @Query("""
            SELECT COUNT(r) FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.success = false
              AND (:providerId IS NULL OR r.providerId = :providerId)
            """)
    long countFailed(@Param("since") Instant since,
                     @Param("providerId") String providerId);
}
