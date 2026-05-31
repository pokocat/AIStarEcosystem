package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.CreditHoldRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
 *
 * <p>v0.33+: 引入 hold / commitHold / releaseHold「预冻结 → 真扣 / 退回」三段式扣费语义，
 * 对应 product_spec_ai_celebrity.md §「提交生成前预冻结积分；任务完成转扣减；失败自动退回」。
 * 业务方约定：
 *   - hold       : 任务创建时调用；额度从 gift/license/recharge 抽走 → 入 pendingBalance，写 FREEZE。
 *   - commitHold : 任务（或子单元）真完成；pending 真扣 → 写 SPEND，commit 累加到 hold.remaining 减完。
 *   - releaseHold: 任务终态失败 / 取消；pending 剩余按 hold 时的桶分布退回 → 写 UNFREEZE。
 *
 * 幂等：靠 {@link CreditHold} 上 (referenceType, referenceId) 唯一约束。重复 hold 直接返回已有记录。
 */
@Service
public class CreditService {

    private static final Logger log = LoggerFactory.getLogger(CreditService.class);

    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final CreditHoldRepository holdRepo;

    public CreditService(WalletRepository walletRepo,
                          LedgerEntryRepository ledgerRepo,
                          CreditHoldRepository holdRepo) {
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
        this.holdRepo = holdRepo;
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
     * 提现（v0.45 drama 财务中心）：从可提现的 recharge 桶扣减 amount，写一条 WITHDRAW LedgerEntry。
     * 仅 recharge 桶（真实充值 / 业务收益）可提现；license / gift 桶不可提现。
     * 可提现余额不足抛 402。满足「积分账本不可变」—— 余额变动经 LedgerEntry。
     */
    @Transactional
    public LedgerEntryDto withdraw(String userId, long amount, String referenceType,
                                   String referenceId, String description) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "提现金额必须为正数");
        }
        Wallet wallet = walletRepo.findByUserId(userId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "钱包不存在或可提现余额不足"));
        if (wallet.getRechargeBalance() < amount) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "可提现余额不足，本次提现需 " + amount + "，当前可提现 " + wallet.getRechargeBalance());
        }
        wallet.setRechargeBalance(wallet.getRechargeBalance() - amount);
        long newBalance = wallet.getTotalBalance() - amount;
        wallet.setTotalBalance(newBalance);
        wallet.setUpdatedAt(Instant.now());
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(userId)
                .entryType(LedgerEntry.LedgerEntryType.WITHDRAW)
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

    // ── v0.33+: hold / commitHold / releaseHold ─────────────────────────────────

    /**
     * 预冻结积分（任务创建时调用）。
     *
     * 把 amount 从可用桶（gift→license→recharge）抽走 → pendingBalance；写一条 FREEZE LedgerEntry；
     * 记一条 ACTIVE 状态的 {@link CreditHold} 留存桶分布，供 release 时按比例退回。
     *
     * 幂等：同 (referenceType, referenceId) 重复调用直接返回已存在记录（不重复扣费）。
     *
     * @return 已存在或新建的 hold；上层只关心 holdId / referenceId 即可。
     */
    @Transactional
    public CreditHold hold(String userId, long amount, String referenceType,
                            String referenceId, String description) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "冻结积分必须为正数");
        }
        if (userId == null || userId.isBlank() || referenceType == null || referenceType.isBlank()
                || referenceId == null || referenceId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "hold 缺少 userId / referenceType / referenceId");
        }

        // 幂等：已存在 ACTIVE / 终态 hold → 直接返回，不再扣
        CreditHold existing = holdRepo.findByReferenceTypeAndReferenceId(referenceType, referenceId).orElse(null);
        if (existing != null) {
            log.info("[credit] hold idempotent hit ref={}:{} status={} amount={}",
                    referenceType, referenceId, existing.getStatus(), existing.getAmount());
            return existing;
        }

        Wallet wallet = getOrCreateWallet(userId);
        if (wallet.getTotalBalance() < amount) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "积分余额不足，本次操作需 " + amount + "，当前可用 " + wallet.getTotalBalance());
        }

        long remaining = amount;
        long fromGift = Math.min(wallet.getGiftBalance(), remaining);
        remaining -= fromGift;
        long fromLicense = Math.min(wallet.getLicenseBalance(), remaining);
        remaining -= fromLicense;
        long fromRecharge = Math.min(wallet.getRechargeBalance(), remaining);
        remaining -= fromRecharge;
        if (remaining != 0) {
            // 余额足但桶分布算错 — 防御性兜底，理论不应触发
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                    "hold 桶分布异常: amount=" + amount + " 剩余=" + remaining);
        }

        wallet.setGiftBalance(wallet.getGiftBalance() - fromGift);
        wallet.setLicenseBalance(wallet.getLicenseBalance() - fromLicense);
        wallet.setRechargeBalance(wallet.getRechargeBalance() - fromRecharge);
        wallet.setTotalBalance(wallet.getTotalBalance() - amount);
        wallet.setPendingBalance(wallet.getPendingBalance() + amount);
        Instant now = Instant.now();
        wallet.setUpdatedAt(now);
        walletRepo.save(wallet);

        // 写 FREEZE 流水：amount 是负数（出账），balanceAfter = 总余额（不含 pending）
        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(userId)
                .entryType(LedgerEntry.LedgerEntryType.FREEZE)
                .amount(-amount)
                .balanceAfter(wallet.getTotalBalance())
                .description(description)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .createdAt(now)
                .build();
        ledgerRepo.save(entry);

        CreditHold hold = CreditHold.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(userId)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .amount(amount)
                .fromGift(fromGift)
                .fromLicense(fromLicense)
                .fromRecharge(fromRecharge)
                .remainingAmount(amount)
                .status(CreditHold.Status.ACTIVE)
                .description(description)
                .createdAt(now)
                .updatedAt(now)
                .build();
        holdRepo.save(hold);
        log.info("[credit] hold ok user={} ref={}:{} amount={} gift={} license={} recharge={}",
                userId, referenceType, referenceId, amount, fromGift, fromLicense, fromRecharge);
        return hold;
    }

    /**
     * 真扣（commit）一笔已 hold 的额度（或其中一部分）。
     *
     * <p>amount 必须 ≤ hold.remainingAmount；commit 后 pendingBalance 减少 amount，
     * 写一条 SPEND LedgerEntry（amount 为负），hold.remainingAmount 减；
     * 若减到 0，hold.status = COMMITTED 且 completedAt 落时间。
     *
     * <p>同 (referenceType, referenceId) 重复 commit 累计金额，不会再次校验幂等
     * （混剪场景就是要逐变体 commit）；上层负责不超额。
     *
     * @return 本次写入的 SPEND ledger 分录。
     */
    @Transactional
    public LedgerEntryDto commitHold(String referenceType, String referenceId,
                                      long amount, String description) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "commit 金额必须为正数");
        }
        CreditHold hold = holdRepo.findByReferenceTypeAndReferenceId(referenceType, referenceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "未找到对应的 hold: " + referenceType + ":" + referenceId));
        if (hold.getStatus() != CreditHold.Status.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "hold 已是终态 (" + hold.getStatus() + ")，无法 commit");
        }
        if (amount > hold.getRemainingAmount()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "commit 金额 " + amount + " 超过剩余 hold " + hold.getRemainingAmount());
        }

        Wallet wallet = walletRepo.findById(hold.getWalletId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "hold 关联 wallet 不存在: " + hold.getWalletId()));
        if (wallet.getPendingBalance() < amount) {
            // pending 被外力打破 — 极端情况，记录但不阻拦
            log.warn("[credit] commit pending<amount user={} pending={} commit={}",
                    wallet.getUserId(), wallet.getPendingBalance(), amount);
        }
        Instant now = Instant.now();
        wallet.setPendingBalance(Math.max(0, wallet.getPendingBalance() - amount));
        wallet.setUpdatedAt(now);
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(hold.getUserId())
                .entryType(LedgerEntry.LedgerEntryType.SPEND)
                .amount(-amount)
                .balanceAfter(wallet.getTotalBalance())
                .description(description)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .createdAt(now)
                .build();
        ledgerRepo.save(entry);

        hold.setRemainingAmount(hold.getRemainingAmount() - amount);
        hold.setUpdatedAt(now);
        if (hold.getRemainingAmount() == 0) {
            hold.setStatus(CreditHold.Status.COMMITTED);
            hold.setCompletedAt(now);
        }
        holdRepo.save(hold);
        log.info("[credit] commit ok ref={}:{} amount={} remaining={} status={}",
                referenceType, referenceId, amount, hold.getRemainingAmount(), hold.getStatus());
        return LedgerEntryDto.from(entry);
    }

    /**
     * 释放（退回）一笔已 hold 的剩余额度。
     *
     * <p>按 hold 时记录的桶分布（fromGift / fromLicense / fromRecharge）按比例退回原桶；
     * pendingBalance 减少 remaining，写一条 UNFREEZE LedgerEntry（amount 为正）。
     * hold.status = RELEASED；completedAt 落时间。remainingAmount = 0 时直接置 RELEASED 并 short-circuit。
     *
     * <p>幂等：已 RELEASED / COMMITTED 的 hold 重复调用返回 null（不再写流水）。
     */
    @Transactional
    public LedgerEntryDto releaseHold(String referenceType, String referenceId, String description) {
        CreditHold hold = holdRepo.findByReferenceTypeAndReferenceId(referenceType, referenceId).orElse(null);
        if (hold == null) {
            log.info("[credit] release no-op ref={}:{} (hold not found)", referenceType, referenceId);
            return null;
        }
        if (hold.getStatus() != CreditHold.Status.ACTIVE) {
            log.info("[credit] release no-op ref={}:{} status={}", referenceType, referenceId, hold.getStatus());
            return null;
        }
        Instant now = Instant.now();
        long remaining = hold.getRemainingAmount();
        if (remaining <= 0) {
            hold.setStatus(CreditHold.Status.RELEASED);
            hold.setCompletedAt(now);
            hold.setUpdatedAt(now);
            holdRepo.save(hold);
            return null;
        }

        Wallet wallet = walletRepo.findById(hold.getWalletId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "hold 关联 wallet 不存在: " + hold.getWalletId()));

        // 按 hold 时桶分布的比例退回。已 commit 一部分时，按剩余比例算每桶退多少。
        long originalAmount = hold.getAmount();
        long backGift, backLicense, backRecharge;
        if (remaining == originalAmount) {
            backGift = hold.getFromGift();
            backLicense = hold.getFromLicense();
            backRecharge = hold.getFromRecharge();
        } else {
            // 按比例。最后一项用 remaining - 前两项保证总和恰好等于 remaining（避免 round 误差）。
            backGift = remaining * hold.getFromGift() / originalAmount;
            backLicense = remaining * hold.getFromLicense() / originalAmount;
            backRecharge = remaining - backGift - backLicense;
        }

        wallet.setGiftBalance(wallet.getGiftBalance() + backGift);
        wallet.setLicenseBalance(wallet.getLicenseBalance() + backLicense);
        wallet.setRechargeBalance(wallet.getRechargeBalance() + backRecharge);
        wallet.setTotalBalance(wallet.getTotalBalance() + remaining);
        wallet.setPendingBalance(Math.max(0, wallet.getPendingBalance() - remaining));
        wallet.setUpdatedAt(now);
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(hold.getUserId())
                .entryType(LedgerEntry.LedgerEntryType.UNFREEZE)
                .amount(remaining)
                .balanceAfter(wallet.getTotalBalance())
                .description(description)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .createdAt(now)
                .build();
        ledgerRepo.save(entry);

        hold.setRemainingAmount(0);
        hold.setStatus(CreditHold.Status.RELEASED);
        hold.setCompletedAt(now);
        hold.setUpdatedAt(now);
        holdRepo.save(hold);
        log.info("[credit] release ok ref={}:{} remaining={} backGift={} backLicense={} backRecharge={}",
                referenceType, referenceId, remaining, backGift, backLicense, backRecharge);
        return LedgerEntryDto.from(entry);
    }

    /** 查询 hold 当前状态（业务侧判断是否需 commit / release 用）。 */
    public CreditHold findHold(String referenceType, String referenceId) {
        return holdRepo.findByReferenceTypeAndReferenceId(referenceType, referenceId).orElse(null);
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
