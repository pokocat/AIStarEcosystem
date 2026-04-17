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

/**
 * Per-user credit wallet operations. See product_spec.md §1.3 / §1.4.
 *
 * Spend priority on debit: gift → license → recharge.
 */
@Service
public class CreditService {

    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;

    public CreditService(WalletRepository walletRepo,
                          LedgerEntryRepository ledgerRepo) {
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
    }

    public Page<WalletDto> listWallets(Pageable pageable) {
        return walletRepo.findAll(pageable).map(WalletDto::from);
    }

    public WalletDto findWalletByUserId(String userId) {
        return walletRepo.findByUserId(userId)
                .map(WalletDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Wallet not found for user: " + userId));
    }

    /**
     * Adjust credits for a platform user (admin operation).
     * Positive amount = credit (treated as gift); negative = debit (gift → license → recharge).
     */
    @Transactional
    public LedgerEntryDto adjustUserCredits(String userId, Map<String, Object> body) {
        long amount = getLong(body, "amount", 0L);
        if (amount == 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "调整积分值不能为 0");
        }

        Wallet wallet = walletRepo.findByUserId(userId).orElseGet(() -> walletRepo.save(Wallet.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .totalBalance(0L)
                .licenseBalance(0L)
                .rechargeBalance(0L)
                .giftBalance(0L)
                .pendingBalance(0L)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build()));

        long newBalance = wallet.getTotalBalance() + amount;
        if (newBalance < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "积分余额不足，无法扣减");
        }

        wallet.setTotalBalance(newBalance);
        LedgerEntry.LedgerEntryType entryType;

        if (amount > 0) {
            wallet.setGiftBalance(wallet.getGiftBalance() + amount);
            entryType = LedgerEntry.LedgerEntryType.GIFT;
        } else {
            long deduct = -amount;
            long fromGift = Math.min(wallet.getGiftBalance(), deduct);
            wallet.setGiftBalance(wallet.getGiftBalance() - fromGift);
            deduct -= fromGift;
            long fromLicense = Math.min(wallet.getLicenseBalance(), deduct);
            wallet.setLicenseBalance(wallet.getLicenseBalance() - fromLicense);
            deduct -= fromLicense;
            long fromRecharge = Math.min(wallet.getRechargeBalance(), deduct);
            wallet.setRechargeBalance(wallet.getRechargeBalance() - fromRecharge);
            entryType = LedgerEntry.LedgerEntryType.ADJUST;
        }
        wallet.setUpdatedAt(Instant.now());
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(userId)
                .entryType(entryType)
                .amount(amount)
                .balanceAfter(newBalance)
                .description(getString(body, "description"))
                .referenceId(userId)
                .referenceType("admin_credit_adjust")
                .createdAt(Instant.now())
                .build();

        return LedgerEntryDto.from(ledgerRepo.save(entry));
    }

    /**
     * Query ledger entries. Supports filtering by walletId and/or userId.
     */
    public Page<LedgerEntryDto> listLedgerEntries(String walletId, String userId, Pageable pageable) {
        Page<LedgerEntry> page;
        if (userId != null) {
            page = ledgerRepo.findByUserId(userId, pageable);
        } else if (walletId != null) {
            page = ledgerRepo.findByWalletId(walletId, pageable);
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
