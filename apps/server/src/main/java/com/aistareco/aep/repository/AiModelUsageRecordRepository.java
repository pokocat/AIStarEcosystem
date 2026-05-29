package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiModelUsageRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AiModelUsageRecordRepository extends JpaRepository<AiModelUsageRecord, String> {

    // 聚合查询返回 Object[]：[0]=分组键, [1]=分组名, [2]=调用次数, [3]=total, [4]=prompt, [5]=completion。
    // 用 Object[] 而非构造器表达式，避开 Long → long 在 JPQL new 表达式里的拆箱兼容坑。

    @Query("""
            SELECT r.providerId, r.providerName,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since
            GROUP BY r.providerId, r.providerName
            """)
    List<Object[]> aggregateByProvider(@Param("since") Instant since);

    @Query("""
            SELECT r.model, r.model,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since
            GROUP BY r.model
            """)
    List<Object[]> aggregateByModel(@Param("since") Instant since);

    @Query("""
            SELECT r.model, r.model,
                   COUNT(r),
                   COALESCE(SUM(r.totalTokens), 0),
                   COALESCE(SUM(r.promptTokens), 0),
                   COALESCE(SUM(r.completionTokens), 0)
            FROM AiModelUsageRecord r
            WHERE r.createdAt >= :since AND r.providerId = :providerId
            GROUP BY r.model
            """)
    List<Object[]> aggregateByModelForProvider(@Param("providerId") String providerId,
                                               @Param("since") Instant since);
}
