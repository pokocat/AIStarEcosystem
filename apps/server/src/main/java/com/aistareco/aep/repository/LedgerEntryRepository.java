package com.aistareco.aep.repository;

import com.aistareco.aep.model.LedgerEntry;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, String>,
        PagingAndSortingRepository<LedgerEntry, String> {

    Page<LedgerEntry> findByWalletId(String walletId, Pageable pageable);

    Page<LedgerEntry> findByTenantId(String tenantId, Pageable pageable);

    Page<LedgerEntry> findByWalletIdAndTenantId(String walletId, String tenantId, Pageable pageable);

    Page<LedgerEntry> findByUserId(String userId, Pageable pageable);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM LedgerEntry e WHERE e.entryType = com.aistareco.aep.model.LedgerEntry.LedgerEntryType.CREDIT")
    long sumTotalCreditsIssued();
}
