package com.aistareco.aep.repository;

import com.aistareco.aep.model.LicenseKey;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LicenseKeyRepository extends JpaRepository<LicenseKey, String>,
        PagingAndSortingRepository<LicenseKey, String> {

    Optional<LicenseKey> findByCodeHash(String codeHash);

    Page<LicenseKey> findByBatchId(String batchId, Pageable pageable);

    Page<LicenseKey> findByStatus(LicenseKey.LicenseKeyStatus status, Pageable pageable);

    Page<LicenseKey> findByBatchIdAndStatus(String batchId, LicenseKey.LicenseKeyStatus status, Pageable pageable);

    long countByStatus(LicenseKey.LicenseKeyStatus status);

    long countByBatchId(String batchId);

    /**
     * v0.47：按批次 + 状态精确计数，用于 LicenseService 把 totalCount / activatedCount
     * 改为从 keys 表实时派生（修复 denormalized 列长期 drift 导致核销数 &gt; 总量的 bug）。
     */
    long countByBatchIdAndStatus(String batchId, LicenseKey.LicenseKeyStatus status);
}
