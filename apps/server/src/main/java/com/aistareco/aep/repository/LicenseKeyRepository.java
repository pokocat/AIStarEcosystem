package com.aistareco.aep.repository;

import com.aistareco.aep.model.LicenseKey;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LicenseKeyRepository extends JpaRepository<LicenseKey, String>,
        PagingAndSortingRepository<LicenseKey, String> {

    Optional<LicenseKey> findByCodeHash(String codeHash);

    Page<LicenseKey> findByBatchId(String batchId, Pageable pageable);

    Page<LicenseKey> findByStatus(LicenseKey.LicenseKeyStatus status, Pageable pageable);

    Page<LicenseKey> findByBatchIdAndStatus(String batchId, LicenseKey.LicenseKeyStatus status, Pageable pageable);

    List<LicenseKey> findAllByBatchId(String batchId);

    long countByStatus(LicenseKey.LicenseKeyStatus status);

    long countByBatchId(String batchId);

    /**
     * v0.47：按批次 + 状态精确计数，用于 LicenseService 把 totalCount / activatedCount
     * 改为从 keys 表实时派生（修复 denormalized 列长期 drift 导致核销数 &gt; 总量的 bug）。
     */
    long countByBatchIdAndStatus(String batchId, LicenseKey.LicenseKeyStatus status);

    /**
     * v0.149（统一账号中心 P2 §12.2）：**条件更新**核销激活码 —— 只有当前仍是 CREATED 才占用。
     *
     * <p>此前核销走「findByCodeHash 读 → 判 status → save」的 read-modify-write，两个并发请求
     * 会同时读到 CREATED，各自发一份积分。改成单条带状态谓词的 UPDATE 后，数据库行锁天然串行化：
     * 返回 1 = 本次抢到，返回 0 = 已被别人（或自己重试）占用，调用方必须当 409 处理，
     * 不得继续发积分 / 写权益。</p>
     *
     * @return 受影响行数（0 或 1）
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update LicenseKey k set k.status = :activated, k.activatedByUserId = :userId, k.activatedAt = :activatedAt "
            + "where k.id = :id and k.status = :created")
    int claimForActivation(@Param("id") String id,
                           @Param("userId") String userId,
                           @Param("activatedAt") java.time.Instant activatedAt,
                           @Param("created") LicenseKey.LicenseKeyStatus created,
                           @Param("activated") LicenseKey.LicenseKeyStatus activated);
}
