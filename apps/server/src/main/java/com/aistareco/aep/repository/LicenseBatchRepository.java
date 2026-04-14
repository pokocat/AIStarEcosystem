package com.aistareco.aep.repository;

import com.aistareco.aep.model.LicenseBatch;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LicenseBatchRepository extends JpaRepository<LicenseBatch, String>,
        PagingAndSortingRepository<LicenseBatch, String> {

    Optional<LicenseBatch> findByBatchNo(String batchNo);

    Page<LicenseBatch> findByProductId(String productId, Pageable pageable);

    Page<LicenseBatch> findByLicenseType(LicenseBatch.LicenseType licenseType, Pageable pageable);
}
