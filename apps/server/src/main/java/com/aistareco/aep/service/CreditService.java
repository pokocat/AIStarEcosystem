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
     * 业务侧扣积分：原子地校验余额、按 gift→license→recharge 顺序扣减、写入一条 LedgerEntry。
     * 余额不足抛 402 PAYMENT_REQUIRED；amount 必须 > 0。
     *
     * @param userId        要扣减的钱包用户
     * @param amount        正数，本次扣减额度
     * @param referenceType 业务来源标识（如 "INCUBATION" / "FORGE"），写入 ledger.referenceType
     * @param referenceId   业务对象 ID（如新建艺人的 ID），写入 ledger.referenceId
     * @param description   人类可读的说明，写入 ledger.description
     */
    @Transactional
    public LedgerEntryDto debit(String userId, long amount, String referenceType,
                                 String referenceId, String description) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "扣减积分必须为正数");
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

        if (wallet.getTotalBalance() < amount) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "积分余额不足，本次操作需 " + amount + "，当前可用 " + wallet.getTotalBalance());
        }

        long deduct = amount;
        long fromGift = Math.min(wallet.getGiftBalance(), deduct);
        wallet.setGiftBalance(wallet.getGiftBalance() - fromGift);
        deduct -= fromGift;
        long fromLicense = Math.min(wallet.getLicenseBalance(), deduct);
        wallet.setLicenseBalance(wallet.getLicenseBalance() - fromLicense);
        deduct -= fromLicense;
        long fromRecharge = Math.min(wallet.getRechargeBalance(), deduct);
        wallet.setRechargeBalance(wallet.getRechargeBalance() - fromRecharge);

        long newBalance = wallet.getTotalBalance() - amount;
        wallet.setTotalBalance(newBalance);
        wallet.setUpdatedAt(Instant.now());
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(userId)
                .entryType(LedgerEntry.LedgerEntryType.ADJUST)
                .amount(-amount)
                .balanceAfter(newBalance)
                .description(description)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .createdAt(Instant.now())
                .build();

        return LedgerEntryDto.from(ledgerRepo.save(entry));
    }

    /**
     * 业务侧"加积分"通用入口（v0.4 新增）：原子地把 amount 加入指定桶并写一条 LedgerEntry。
     * 调用方负责选对桶：
     *   - RECHARGE：充值落账
     *   - GIFT：活动赠送 / 充值赠送
     *   - INCOME：业务收益
     *   - LICENSE_GRANT：license 核销
     *   - REFUND：退款
     *
     * @param entryType   LedgerEntry 类型（同时决定加哪个桶；FREEZE/UNFREEZE/SPEND/WITHDRAW/ADJUST 不在此处理）
     */
    @Transactional
    public LedgerEntryDto creditAccount(String userId, long amount,
                                         LedgerEntry.LedgerEntryType entryType,
                                         String referenceType, String referenceId, String description) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "入账金额必须为正数");
        }
        if (entryType == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "缺少入账类型");
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

        switch (entryType) {
            case RECHARGE -> wallet.setRechargeBalance(wallet.getRechargeBalance() + amount);
            case GIFT -> wallet.setGiftBalance(wallet.getGiftBalance() + amount);
            case LICENSE_GRANT -> wallet.setLicenseBalance(wallet.getLicenseBalance() + amount);
            case INCOME -> wallet.setRechargeBalance(wallet.getRechargeBalance() + amount); // 业务收益默认进 recharge 桶
            case REFUND -> wallet.setRechargeBalance(wallet.getRechargeBalance() + amount);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "creditAccount 不支持的入账类型：" + entryType);
        }

        long newBalance = wallet.getTotalBalance() + amount;
        wallet.setTotalBalance(newBalance);
        wallet.setUpdatedAt(Instant.now());
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(userId)
                .entryType(entryType)
                .amount(amount)
                .balanceAfter(newBalance)
                .description(description)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .createdAt(Instant.now())
                .build();

        return LedgerEntryDto.from(ledgerRepo.save(entry));
    }

    /** 实体级 wallet 取数（recharge 等流程需要返回最新 WalletDto 时复用）。 */
    public Wallet getOrCreateWallet(String userId) {
        return walletRepo.findByUserId(userId).orElseGet(() -> walletRepo.save(Wallet.builder()
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
