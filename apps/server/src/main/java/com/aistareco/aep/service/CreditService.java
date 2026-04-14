package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class CreditService {

    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;

    public CreditService(WalletRepository walletRepo, LedgerEntryRepository ledgerRepo) {
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
    }

    public Page<WalletDto> listWallets(Pageable pageable) {
        return walletRepo.findAll(pageable).map(WalletDto::from);
    }

    public WalletDto findWalletByTenantId(String tenantId) {
        return walletRepo.findByTenantId(tenantId)
                .map(WalletDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Wallet not found for tenant: " + tenantId));
    }

    @Transactional
    public LedgerEntryDto creditWallet(String tenantId, Map<String, Object> body) {
        long amount = getLong(body, "amount", 0L);
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Credit amount must be positive");
        }

        Wallet wallet = walletRepo.findByTenantId(tenantId).orElseGet(() -> {
            Wallet w = Wallet.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(tenantId)
                    .totalBalance(0L)
                    .giftBalance(0L)
                    .rechargeBalance(0L)
                    .planBalance(0L)
                    .createdAt(Instant.now())
                    .updatedAt(Instant.now())
                    .build();
            return walletRepo.save(w);
        });

        wallet.setTotalBalance(wallet.getTotalBalance() + amount);
        wallet.setRechargeBalance(wallet.getRechargeBalance() + amount);
        wallet.setUpdatedAt(Instant.now());
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .tenantId(tenantId)
                .entryType(LedgerEntry.LedgerEntryType.CREDIT)
                .amount(amount)
                .balanceAfter(wallet.getTotalBalance())
                .description(getString(body, "description"))
                .referenceId(getString(body, "referenceId"))
                .referenceType(getString(body, "referenceType"))
                .createdAt(Instant.now())
                .build();

        return LedgerEntryDto.from(ledgerRepo.save(entry));
    }

    public Page<LedgerEntryDto> listLedgerEntries(String walletId, String tenantId, Pageable pageable) {
        Page<LedgerEntry> page;
        if (walletId != null && tenantId != null) {
            page = ledgerRepo.findByWalletIdAndTenantId(walletId, tenantId, pageable);
        } else if (walletId != null) {
            page = ledgerRepo.findByWalletId(walletId, pageable);
        } else if (tenantId != null) {
            page = ledgerRepo.findByTenantId(tenantId, pageable);
        } else {
            page = ledgerRepo.findAll(pageable);
        }
        return page.map(LedgerEntryDto::from);
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }

    private long getLong(Map<String, Object> body, String key, long defaultVal) {
        Object val = body.get(key);
        if (val == null) return defaultVal;
        if (val instanceof Number n) return n.longValue();
        return Long.parseLong(val.toString());
    }
}
