package com.aistareco.aep.repository;

import com.aistareco.aep.model.LicenseKey;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LicenseKeyRepository extends JpaRepository<LicenseKey, String>,
        PagingAndSortingRepository<LicenseKey, String> {

    Page<LicenseKey> findByBatchId(String batchId, Pageable pageable);

    Page<LicenseKey> findByStatus(LicenseKey.LicenseKeyStatus status, Pageable pageable);

    Page<LicenseKey> findByBatchIdAndStatus(String batchId, LicenseKey.LicenseKeyStatus status, Pageable pageable);

    long countByStatus(LicenseKey.LicenseKeyStatus status);

    long countByBatchId(String batchId);
}
