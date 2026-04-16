package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.MembershipRepository;
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
    private final MembershipRepository membershipRepo;

    public CreditService(WalletRepository walletRepo,
                          LedgerEntryRepository ledgerRepo,
                          MembershipRepository membershipRepo) {
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
        this.membershipRepo = membershipRepo;
    }

    public Page<WalletDto> listWallets(Pageable pageable) {
        return walletRepo.findAll(pageable).map(WalletDto::from);
    }

    public WalletDto findWalletByTenantId(String tenantId) {
        return walletRepo.findByTenantId(tenantId)
                .map(WalletDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Wallet not found for tenant: " + tenantId));
    }

    /**
     * Manually credit a tenant's wallet (admin operation).
     * Optionally include {@code userId} in body to attribute the credit to a specific user.
     */
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
                .userId(getString(body, "userId"))
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

    /**
     * Adjust credits for a specific platform user.
     * Finds the user's primary tenant wallet, applies the delta (positive = credit, negative = debit).
     */
    @Transactional
    public LedgerEntryDto adjustUserCredits(String userId, Map<String, Object> body) {
        long amount = getLong(body, "amount", 0L);
        if (amount == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "调整积分值不能为 0");
        }

        // Find the user's primary tenant (first membership, preferring OWNER role)
        String tenantId = membershipRepo.findByUserId(userId).stream()
                .sorted((a, b) -> {
                    if ("OWNER".equals(a.getTenantRole())) return -1;
                    if ("OWNER".equals(b.getTenantRole())) return 1;
                    return 0;
                })
                .map(m -> m.getTenantId())
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "该用户没有关联的租户，无法调整积分"));

        Wallet wallet = walletRepo.findByTenantId(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "租户钱包不存在"));

        long newBalance = wallet.getTotalBalance() + amount;
        if (newBalance < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "积分余额不足，无法扣减");
        }

        wallet.setTotalBalance(newBalance);
        if (amount > 0) {
            wallet.setGiftBalance(wallet.getGiftBalance() + amount);
        } else {
            // Deduct from recharge first, then gift
            long deduct = -amount;
            long fromRecharge = Math.min(wallet.getRechargeBalance(), deduct);
            wallet.setRechargeBalance(wallet.getRechargeBalance() - fromRecharge);
            wallet.setGiftBalance(wallet.getGiftBalance() - (deduct - fromRecharge));
        }
        wallet.setUpdatedAt(Instant.now());
        walletRepo.save(wallet);

        LedgerEntry.LedgerEntryType entryType = amount > 0
                ? LedgerEntry.LedgerEntryType.CREDIT
                : LedgerEntry.LedgerEntryType.DEBIT;

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .tenantId(tenantId)
                .userId(userId)
                .entryType(entryType)
                .amount(Math.abs(amount))
                .balanceAfter(newBalance)
                .description(getString(body, "description"))
                .referenceId(userId)
                .referenceType("admin_credit_adjust")
                .createdAt(Instant.now())
                .build();

        return LedgerEntryDto.from(ledgerRepo.save(entry));
    }

    /**
     * Query ledger entries. Supports filtering by walletId, tenantId, and/or userId.
     */
    public Page<LedgerEntryDto> listLedgerEntries(String walletId, String tenantId, String userId, Pageable pageable) {
        Page<LedgerEntry> page;
        if (userId != null) {
            page = ledgerRepo.findByUserId(userId, pageable);
        } else if (walletId != null && tenantId != null) {
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
