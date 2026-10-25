package com.aistareco.aep.service;

import com.aistareco.aep.billing.service.ModelChargeContext;
import com.aistareco.aep.billing.service.ModelChargeService;
import com.aistareco.aep.billing.service.ModelBillingMath;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.CreditHold;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.AepUserRepository;
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
    private final AepUserRepository userRepo;

    @org.springframework.beans.factory.annotation.Autowired
    private ModelChargeService modelCharges;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager enterpriseEntityManager;

    @org.springframework.beans.factory.annotation.Autowired
    private com.aistareco.aep.enterprise.service.EnterpriseCreditLotService enterpriseCreditLots;
    @org.springframework.beans.factory.annotation.Autowired @org.springframework.context.annotation.Lazy
    private com.aistareco.aep.enterprise.service.EnterpriseBillingService enterpriseBilling;
    @org.springframework.beans.factory.annotation.Autowired @org.springframework.context.annotation.Lazy
    private com.aistareco.aep.enterprise.service.EnterpriseFundRecoveryService enterpriseRecovery;

    public CreditService(WalletRepository walletRepo,
                          LedgerEntryRepository ledgerRepo,
                          CreditHoldRepository holdRepo,
                          AepUserRepository userRepo) {
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
        this.holdRepo = holdRepo;
        this.userRepo = userRepo;
    }

    /** admin 结算中心钱包快照：附带账号登录名 / 昵称（v0.58，批量查询避免 N+1）。 */
    public Page<WalletDto> listWallets(Pageable pageable) {
        Page<Wallet> page = walletRepo.findAll(pageable);
        Map<String, AepUser> users = usersByIds(page.map(Wallet::getUserId).toList());
        return page.map(w -> WalletDto.from(w, w.getUserId()==null?null:users.get(w.getUserId())));
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

        // v2 §5: 悲观行锁取钱包，串行化并发写余额（调差 vs 充值/消费），防 lost update。
        Wallet wallet = getOrCreateWalletForUpdate(userId);

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
        return debit(userId, amount, LedgerEntry.LedgerEntryType.ADJUST, referenceType, referenceId, description);
    }

    /**
     * 同 {@link #debit(String, long, String, String, String)}，但允许调用方指定 ledger entryType
     * （例如商店买断式购买用 SPEND，而非默认的 ADJUST）。
     *
     * <p>v0.99 例行 QA 新增：抽出此重载让 {@code StoreService.redeem} 等「立即扣费」场景也能走
     * CreditService 的悲观行锁 + gift→license→recharge 扣桶顺序，不必各自手写
     * {@code walletRepo.findByUserIdForUpdate → setXxxBalance → save}（AGENTS.md §4.2 硬规则）。
     */
    @Transactional
    public LedgerEntryDto debit(String userId, long amount, LedgerEntry.LedgerEntryType entryType,
                                 String referenceType, String referenceId, String description) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "扣减积分必须为正数");
        }
        // v2 §5: 悲观行锁，串行化并发写余额，防 lost update。
        Wallet wallet = getOrCreateWalletForUpdate(userId);
        return debitWalletLocked(wallet, amount, entryType, referenceType, referenceId, description);
    }

    @Transactional
    public LedgerEntryDto debitWallet(String walletId, long amount, LedgerEntry.LedgerEntryType entryType,
                                      String referenceType, String referenceId, String description) {
        if (amount <= 0 || entryType != LedgerEntry.LedgerEntryType.SPEND)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "内部扣减必须为正数消费");
        Wallet wallet=requiredWalletForUpdate(walletId);
        if(!"personal".equals(wallet.getAccountType())) throw new ResponseStatusException(HttpStatus.FORBIDDEN,"企业消费必须通过冻结付款授权");
        return debitWalletLocked(wallet, amount, entryType, referenceType, referenceId, description);
    }

    private LedgerEntryDto debitWalletLocked(Wallet wallet, long amount, LedgerEntry.LedgerEntryType entryType,
                                            String referenceType, String referenceId, String description) {
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
                .userId(wallet.getUserId())
                .enterpriseId(wallet.getEnterpriseId())
                .entryType(entryType)
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
     * 提现（v0.65）：从可用余额原子扣减并写 WITHDRAW 账本（与 {@link #debit} 同扣桶顺序）。
     * 余额不足抛 402。真实打款由运营线下处理，本方法只负责账本侧扣减。
     */
    @Transactional
    public LedgerEntryDto withdraw(String userId, long amount, String description) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "提现金额必须为正数");
        }
        Wallet wallet = walletRepo.findByUserIdForUpdate(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, "钱包不存在或余额不足"));
        if (wallet.getTotalBalance() < amount) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "余额不足，本次提现需 " + amount + "，当前可用 " + wallet.getTotalBalance());
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
                .entryType(LedgerEntry.LedgerEntryType.WITHDRAW)
                .amount(-amount)
                .balanceAfter(newBalance)
                .description(description)
                .referenceType("WITHDRAW")
                .createdAt(Instant.now())
                .build();
        return LedgerEntryDto.from(ledgerRepo.save(entry));
    }

    /**
     * 业务侧"加积分"通用入口（v0.4 新增）：原子地把 amount 加入指定桶并写一条 LedgerEntry。
     * 桶分配严格对齐 v2 §1 两平面：<b>只有 RECHARGE（现金充值）进 recharge 现金背书桶</b>，
     * 其余皆积分面（非现金负债）：
     *   - RECHARGE：充值落账 → <b>recharge 桶（唯一现金背书入账）</b>
     *   - GIFT：活动赠送 / 充值赠送 → gift 桶
     *   - LICENSE_GRANT：license 核销 → license 桶
     *   - INCOME：业务收益（积分面，非现金）→ gift 桶（v2 M2）
     *   - REFUND：积分面退款（<b>已弃用</b>，改走 {@link #releaseHold} 退回原桶）→ gift 桶兜底（v2 M2）
     *
     * <p><b>v2 M2 修复：INCOME / REFUND 不再进 recharge 桶。</b>否则会污染
     * {@link #refundCashReclaim} 依赖的「{@code rechargeBalance} = 未消费现金充值额」不变量，
     * 让非现金积分被当作现金退掉。落 gift 桶对 {@code totalBalance} 无差别（gift 同样计入总额）。
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
        // v2 §5: 悲观行锁取钱包，串行化并发写余额（入账 vs 消费），防 lost update。
        return creditWalletLocked(getOrCreateWalletForUpdate(userId), amount, entryType, referenceType, referenceId, description);
    }

    @Transactional
    public LedgerEntryDto creditWallet(String walletId, long amount, LedgerEntry.LedgerEntryType entryType,
                                       String referenceType, String referenceId, String description) {
        if (amount <= 0 || entryType == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "入账金额和类型无效");
        return creditWalletLocked(requiredWalletForUpdate(walletId), amount, entryType, referenceType, referenceId, description);
    }

    private LedgerEntryDto creditWalletLocked(Wallet wallet, long amount, LedgerEntry.LedgerEntryType entryType,
                                              String referenceType, String referenceId, String description) {
        // Compute before mutation so overflow cannot leave a partially changed entity.
        long newBalance = Math.addExact(wallet.getTotalBalance(), amount);
        switch (entryType) {
            // RECHARGE 是唯一进现金背书 recharge 桶的入账类型（守 refundCashReclaim 的 clamp 不变量）。
            case RECHARGE -> wallet.setRechargeBalance(wallet.getRechargeBalance() + amount);
            case GIFT -> wallet.setGiftBalance(wallet.getGiftBalance() + amount);
            case LICENSE_GRANT -> wallet.setLicenseBalance(wallet.getLicenseBalance() + amount);
            // v2 M2：INCOME（业务收益）是积分面（非现金）→ gift 桶，绝不污染 recharge 现金桶。
            case INCOME -> wallet.setGiftBalance(wallet.getGiftBalance() + amount);
            // v2 M2：REFUND（积分面退款）已弃用（改走 releaseHold 退原桶）；保留分支兜底，同样落 gift 桶，绝不进 recharge。
            case REFUND -> wallet.setGiftBalance(wallet.getGiftBalance() + amount);
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "creditAccount 不支持的入账类型：" + entryType);
        }

        wallet.setTotalBalance(newBalance);
        wallet.setUpdatedAt(Instant.now());
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(wallet.getUserId())
                .enterpriseId(wallet.getEnterpriseId())
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

    /**
     * v2 §15.5 / D17 现金退款回收：现金退款的<b>同事务</b>积分回收。补堵审计 #9 真洞 —— 退现金却不收回
     * 用户已持有的对应积分 = 钱与积分两头占。
     *
     * <p>回收额 <b>clamp 到当前未消费充值余额</b>（{@code min(requestedCredits, rechargeBalance)}）：
     * 充值进 rechargeBalance 且消费时该桶最后扣（gift→license→recharge），故 rechargeBalance 即「未消费充值额」
     * 的下界。花光 → 回收 0（refund 0）；部分消费 → 回收未消费部分。写一条资金面 {@code REFUND_CASH}
     * 分录（amount 为负），cashArtifactId 链到现金凭证（订单 id）。这是 §13#2 允许扣减 rechargeBalance 的
     * <b>唯一</b>显式通道（普通负 ADJUST 禁止碰现金桶）。
     *
     * @param requestedCredits 期望回收额（通常 = 订单 credits），实际按可用余额 clamp
     * @return 写入的 REFUND_CASH 分录；clamp 后为 0 时抛 409（已消费完毕，无可退）
     */
    @Transactional
    public LedgerEntryDto refundCashReclaim(String userId, long requestedCredits,
                                            String cashArtifactId, String description) {
        if (requestedCredits <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "退款回收额必须为正数");
        }
        Wallet wallet = getOrCreateWalletForUpdate(userId);
        long reclaimable = Math.min(requestedCredits, wallet.getRechargeBalance());
        if (reclaimable <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "无可回收的未消费充值额度（充值积分已消费完毕），不可走现金退款回收");
        }

        wallet.setRechargeBalance(wallet.getRechargeBalance() - reclaimable);
        long newBalance = wallet.getTotalBalance() - reclaimable;
        wallet.setTotalBalance(newBalance);
        wallet.setUpdatedAt(Instant.now());
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(userId)
                .entryType(LedgerEntry.LedgerEntryType.REFUND_CASH)
                .amount(-reclaimable)
                .balanceAfter(newBalance)
                .description(description)
                .referenceId(cashArtifactId)
                .referenceType("refund_cash")
                .createdAt(Instant.now())
                .build();
        // entryType=REFUND_CASH → @PrePersist 标 plane=MONEY、cashArtifactId=referenceId（链到订单）。
        log.info("[credit] refund-cash reclaim user={} requested={} reclaimed={} cashArtifact={}",
                userId, requestedCredits, reclaimable, cashArtifactId);
        return LedgerEntryDto.from(ledgerRepo.save(entry));
    }

    // ── v0.33+: hold / commitHold / releaseHold ─────────────────────────────────

    /**
     * 预冻结积分（任务创建时调用）。
     *
     * 模型任务先按用途计算成交价并冻结模型赠款批次；仅普通积分部分从可用桶抽走进入 pendingBalance。
     * CreditHold.amount 保留任务原计价单位，ModelCharge 保存成交价及用量快照，释放按原资金来源退回。
     *
     * 幂等：同 (referenceType, referenceId) 重复调用直接返回已存在记录（不重复扣费）。
     *
     * @return 已存在或新建的 hold；上层只关心 holdId / referenceId 即可。
     */
    @Transactional
    public CreditHold hold(String userId, long amount, String referenceType,
                            String referenceId, String description, ModelChargeContext context) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "冻结积分必须为正数");
        }
        if (userId == null || userId.isBlank() || referenceType == null || referenceType.isBlank()
                || referenceId == null || referenceId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "hold 缺少 userId / referenceType / referenceId");
        }

        // 幂等检查必须在拿到钱包行锁之后做（而不是之前）：并发重复请求（同 userId，同 referenceId，
        // 例如双击/客户端重试）如果先查后锁，两次调用都可能读到"未存在"，各自往下走到钱包扣款，
        // 第二次落 CreditHold 时撞 (referenceType, referenceId) 唯一约束报 500，而不是幂等返回。
        // 钱包行锁把同一 userId 的并发 hold 调用串行化——后到者拿到锁时，先到者已提交，此时再查一定能读到。
        return holdWalletLocked(getOrCreateWalletForUpdate(userId), amount, referenceType, referenceId,
                description, userId, null, null, context,null);
    }

    @Transactional
    public CreditHold holdWallet(String walletId, long amount, String referenceType, String referenceId,
                                  String description, String actorUserId, String membershipId, String authorizationId, ModelChargeContext context) {
        if (amount <= 0 || referenceType == null || referenceType.isBlank() || referenceId == null || referenceId.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "冻结参数无效");
        walletRepo.findById(walletId).ifPresent(w->lockEnterpriseMoney(w.getEnterpriseId()));
        Wallet wallet=requiredWalletForUpdate(walletId);
        if ("enterprise".equals(wallet.getAccountType()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "企业主账户不能直接生成消费");
        if ("personal".equals(wallet.getAccountType()) && !java.util.Objects.equals(wallet.getUserId(),actorUserId))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"个人钱包操作人不匹配");
        if (wallet.getEnterpriseId()!=null && (actorUserId==null || !actorUserId.equals(wallet.getMemberUserId())
                || membershipId==null || authorizationId==null))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "企业冻结缺少成员及付款授权");
        return holdWalletLocked(wallet,amount,referenceType,referenceId,description,actorUserId,membershipId,authorizationId,context,null);
    }

    /** Extend one original payer and endpoint reservation without re-resolving its discount. */
    @Transactional
    public CreditHold holdExtension(String referenceType,String parentReference,String referenceId,long amount,String description,String authorizationId) {
        if(amount<=0)throw new IllegalArgumentException("Extension must be positive");
        lockReferencedWallet(referenceType,parentReference);
        var parent=holdRepo.findByReferenceTypeAndReferenceIdForUpdate(referenceType,parentReference).orElseThrow();refreshLocked(parent);
        if(parent.getStatus()!=CreditHold.Status.ACTIVE)throw new ResponseStatusException(HttpStatus.CONFLICT,"Original reservation is closed");
        if(parent.getEnterpriseId()!=null&&authorizationId==null)throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Enterprise payment authorization is required");
        var extension=modelCharges.extension(parent,amount);
        return holdWalletLocked(requiredWalletForUpdate(parent.getWalletId()),amount,referenceType,referenceId,description,
                parent.getActorUserId()==null?parent.getUserId():parent.getActorUserId(),parent.getMembershipId(),authorizationId,extension.context(),extension.accepted()==null?null:extension);
    }
    public ModelChargeService.Breakdown modelBillingBreakdown(String referenceType,java.util.List<String> references) {
        return modelCharges==null?null:modelCharges.breakdown(referenceType,references);
    }
    /** See {@link ModelChargeService#usedPromotion}; false for legacy holds and holds without a model charge. */
    public boolean usedModelPromotion(CreditHold hold) {
        return hold!=null&&modelCharges!=null&&modelCharges.usedPromotion(hold.getId());
    }
    public long availableModelCredits(Wallet wallet,com.aistareco.aep.billing.service.ModelBillingTarget target) {
        return modelCharges==null?wallet.getTotalBalance():modelCharges.availableCredits(wallet,target,null,0,0);
    }
    public long availableExtensionCredits(String referenceType,String referenceId) {
        var parent=holdRepo.findByReferenceTypeAndReferenceId(referenceType,referenceId).orElseThrow();
        var wallet=walletRepo.findById(parent.getWalletId()).orElseThrow();var extension=modelCharges.extension(parent,1);
        return extension.accepted()==null?wallet.getTotalBalance():modelCharges.availableCredits(wallet,extension.context().target(),extension.accepted(),extension.reservedPayable(),extension.reservedBase());
    }
    /** A shared terminal settlement for credit-denominated model reservations; legacy callers keep their old path. */
    @Transactional
    public boolean settleModelCredits(String referenceType,java.util.List<String> references,long actual) {
        if(references==null||references.isEmpty()||modelCharges==null)return false;
        lockReferencedWallet(referenceType,references.get(0));
        var holds=new java.util.ArrayList<CreditHold>();
        for(String ref:references.stream().distinct().toList()) {
            var hold=holdRepo.findByReferenceTypeAndReferenceIdForUpdate(referenceType,ref).orElse(null);refreshLocked(hold);
            if(hold==null)return false;holds.add(hold);
        }
        var wallet=requiredWalletForUpdate(holds.get(0).getWalletId());
        if(holds.stream().anyMatch(h->!wallet.getId().equals(h.getWalletId())))throw new IllegalArgumentException("Mixed payment wallets");
        var now=Instant.now();var slices=modelCharges.consumeCreditBatch(wallet,holds,actual,now);
        if(slices==null)return false;
        for(var slice:slices) {
            if(slice.base()>0)commitRecorded(wallet,slice.hold(),slice.base(),"Model usage settlement",slice.settlement(),true,now);
            if(slice.base()<slice.hold().getAmount())releaseHold(referenceType,slice.hold().getReferenceId(),"Unused model reservation released");
        }
        return true;
    }

    private CreditHold holdWalletLocked(Wallet wallet, long amount, String referenceType, String referenceId,
                                         String description, String actorUserId, String membershipId, String authorizationId, ModelChargeContext context,ModelChargeService.Extension inherited) {
        java.util.Objects.requireNonNull(context,"Every hold must explicitly declare its billing context");
        // Lock order for money operations: wallet -> hold. New references are serialized by wallet.
        // 幂等：已存在 ACTIVE / 终态 hold → 直接返回，不再扣
        CreditHold existing = holdRepo.findByReferenceTypeAndReferenceIdForUpdate(referenceType, referenceId).orElse(null);
        refreshLocked(existing);
        if (existing != null) {
            if (!java.util.Objects.equals(existing.getWalletId(),wallet.getId()) || existing.getAmount()!=amount
                    || !java.util.Objects.equals(existing.getActorUserId()==null?existing.getUserId():existing.getActorUserId(),actorUserId)
                    || !java.util.Objects.equals(existing.getMembershipId(),membershipId)
                    || !java.util.Objects.equals(existing.getBillingAuthorizationId(),authorizationId))
                throw new ResponseStatusException(HttpStatus.CONFLICT,"冻结引用的账户、金额或付款授权不一致");
            log.info("[credit] hold idempotent hit ref={}:{} status={} amount={}",
                    referenceType, referenceId, existing.getStatus(), existing.getAmount());
            if(modelCharges!=null)modelCharges.verifyReplay(existing,context);
            return existing;
        }

        Instant now=Instant.now();
        CreditHold hold=CreditHold.builder().id(UUID.randomUUID().toString()).walletId(wallet.getId()).userId(wallet.getUserId())
                .actorUserId(actorUserId).enterpriseId(wallet.getEnterpriseId()).membershipId(membershipId).billingAuthorizationId(authorizationId)
                .referenceType(referenceType).referenceId(referenceId).amount(amount).remainingAmount(amount).status(CreditHold.Status.ACTIVE)
                .description(description).createdAt(now).updatedAt(now).build();
        // Model amounts remain the workers' base-price units. Only ordinary credits enter Wallet.pendingBalance.
        long walletAmount=context.target()==null?amount:modelCharges.reserve(wallet,hold,context,now,inherited);
        if (wallet.getTotalBalance() < walletAmount) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,
                    "积分余额不足，本次操作需 " + walletAmount + "，当前可用 " + wallet.getTotalBalance());
        }

        long remaining = walletAmount;
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
        wallet.setTotalBalance(wallet.getTotalBalance() - walletAmount);
        wallet.setPendingBalance(Math.addExact(wallet.getPendingBalance(),walletAmount));
        wallet.setUpdatedAt(now);
        walletRepo.save(wallet);

        // 写 FREEZE 流水：amount 是负数（出账），balanceAfter = 总余额（不含 pending）
        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(wallet.getUserId())
                .actorUserId(actorUserId).enterpriseId(wallet.getEnterpriseId())
                .membershipId(membershipId).billingAuthorizationId(authorizationId)
                .entryType(LedgerEntry.LedgerEntryType.FREEZE)
                .amount(-walletAmount)
                .balanceAfter(wallet.getTotalBalance())
                .description(description)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .createdAt(now)
                .build();
        // A model job fully covered by a grant moves no ordinary credits; its grant rows carry the record instead of a "freeze 0".
        if(walletAmount>0)ledgerRepo.save(entry);

        hold.setFromGift(fromGift);hold.setFromLicense(fromLicense);hold.setFromRecharge(fromRecharge);
        holdRepo.save(hold);
        if(wallet.getEnterpriseId()!=null && fromRecharge>0) enterpriseCreditLots.reserve(wallet,hold);
        log.info("[credit] hold ok user={} ref={}:{} amount={} gift={} license={} recharge={}",
                wallet.getUserId(), referenceType, referenceId, amount, fromGift, fromLicense, fromRecharge);
        return hold;
    }

    /**
     * 真扣（commit）一笔已 hold 的额度（或其中一部分）。
     *
     * <p>amount 必须 ≤ hold.remainingAmount；模型任务按累计实际用量和原价格快照结算，
     * pendingBalance 仅减普通积分消费额，赠款消费另记流水；hold.remainingAmount 按原计价金额减；
     * 若减到 0，hold.status = COMMITTED 且 completedAt 落时间。
     *
     * <p>同 (referenceType, referenceId) 重复 commit 累计金额，不会再次校验幂等
     * （混剪场景就是要逐变体 commit）；上层负责不超额。
     *
     * @return 本次写入的 SPEND ledger 分录。
     */
    @Transactional
    public LedgerEntryDto commitHold(String referenceType, String referenceId,
                                      long amount, String description, ModelBillingMath.Usage cumulativeUsage) {
        if (amount <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "commit 金额必须为正数");
        }
        lockReferencedWallet(referenceType, referenceId);
        CreditHold hold = holdRepo.findByReferenceTypeAndReferenceIdForUpdate(referenceType, referenceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "未找到对应的 hold: " + referenceType + ":" + referenceId));
        refreshLocked(hold);
        if (hold.getStatus() != CreditHold.Status.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "hold 已是终态 (" + hold.getStatus() + ")，无法 commit");
        }
        if (amount > hold.getRemainingAmount()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "commit 金额 " + amount + " 超过剩余 hold " + hold.getRemainingAmount());
        }

        Wallet wallet = requiredWalletForUpdate(hold.getWalletId());
        Instant now = Instant.now();
        boolean modelCharge=modelCharges!=null && modelCharges.isModelCharge(hold.getId());
        var settled=modelCharge?modelCharges.consume(wallet,hold,amount,cumulativeUsage,now)
                :new ModelChargeService.Settlement(0,amount,hold.getRemainingAmount()-amount);
        return commitRecorded(wallet,hold,amount,description,settled,modelCharge,now);
    }

    private LedgerEntryDto commitRecorded(Wallet wallet,CreditHold hold,long amount,String description,
            ModelChargeService.Settlement settled,boolean modelCharge,Instant now) {
        String referenceType=hold.getReferenceType(),referenceId=hold.getReferenceId();
        if (wallet.getPendingBalance() < settled.ordinary()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,"钱包冻结余额与任务不一致，请核对");
        }
        wallet.setPendingBalance(wallet.getPendingBalance() - settled.ordinary());
        wallet.setUpdatedAt(now);
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(hold.getUserId())
                .actorUserId(hold.getActorUserId()).enterpriseId(hold.getEnterpriseId())
                .membershipId(hold.getMembershipId()).billingAuthorizationId(hold.getBillingAuthorizationId())
                .entryType(LedgerEntry.LedgerEntryType.SPEND)
                .amount(-settled.ordinary())
                .balanceAfter(wallet.getTotalBalance())
                .description(description)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .createdAt(now)
                .build();
        // Grant-paid model usage is recorded by SCOPED_SPEND; skip an ordinary "spend 0" row.
        boolean recorded=!modelCharge||settled.ordinary()>0;
        if(recorded)ledgerRepo.save(entry);

        if(hold.getEnterpriseId()!=null) enterpriseCreditLots.commit(hold,settled.ordinaryRemaining());
        hold.setRemainingAmount(hold.getRemainingAmount() - amount);
        hold.setUpdatedAt(now);
        if (hold.getRemainingAmount() == 0) {
            if(modelCharge) {
                // Rounded base credits may be exhausted before all reserved usage is consumed.
                // Close both allocations now; a later releaseHold sees this terminal hold and is a no-op.
                long unused=modelCharges.release(wallet,hold,now);
                if(unused>0)releaseWalletRemainder(wallet,hold,unused,"任务完成 · 退回未用积分",now,true);
                modelCharges.finishResources(hold.getId(),null,now);
            }
            hold.setStatus(CreditHold.Status.COMMITTED);
            hold.setCompletedAt(now);
        }
        holdRepo.save(hold);
        if(hold.getEnterpriseId()!=null && hold.getRemainingAmount()==0 && enterpriseBilling!=null)
            enterpriseBilling.complete(referenceType,referenceId);
        log.info("[credit] commit ok ref={}:{} amount={} remaining={} status={}",
                referenceType, referenceId, amount, hold.getRemainingAmount(), hold.getStatus());
        return recorded?LedgerEntryDto.from(entry):null;
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
        lockReferencedWallet(referenceType, referenceId);
        CreditHold hold = holdRepo.findByReferenceTypeAndReferenceIdForUpdate(referenceType, referenceId).orElse(null);
        refreshLocked(hold);
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
            if(hold.getEnterpriseId()!=null && enterpriseBilling!=null)enterpriseBilling.complete(referenceType,referenceId);
            return null;
        }

        Wallet wallet = requiredWalletForUpdate(hold.getWalletId());

        boolean modelCharge=modelCharges!=null && modelCharges.isModelCharge(hold.getId());
        if(modelCharge)remaining=modelCharges.release(wallet,hold,now);

        LedgerEntryDto released=releaseWalletRemainder(wallet,hold,remaining,description,now,modelCharge);
        hold.setRemainingAmount(0);
        hold.setStatus(CreditHold.Status.RELEASED);
        hold.setCompletedAt(now);
        hold.setUpdatedAt(now);
        holdRepo.save(hold);
        if(modelCharge)modelCharges.finishResources(hold.getId(),null,now);
        if(hold.getEnterpriseId()!=null) {
            if(enterpriseBilling!=null)enterpriseBilling.complete(referenceType,referenceId);
        }
        log.info("[credit] release ok ref={}:{} remaining={}",referenceType,referenceId,remaining);
        return released;
    }

    private LedgerEntryDto releaseWalletRemainder(Wallet wallet,CreditHold hold,long remaining,
                                                   String description,Instant now,boolean modelCharge) {
        // Refund only the ordinary allocation, preserving original buckets and enterprise recharge provenance.
        long originalAmount = modelCharge?modelCharges.ordinaryTotal(hold):hold.getAmount();
        long backGift, backLicense, backRecharge;
        if (remaining == originalAmount) {
            backGift = hold.getFromGift();
            backLicense = hold.getFromLicense();
            backRecharge = hold.getFromRecharge();
        } else if (modelCharge || hold.getEnterpriseId()!=null) {
            // Cumulative bucket boundaries keep every original source monotonic under partial settlement.
            var rem=java.math.BigInteger.valueOf(remaining);var original=java.math.BigInteger.valueOf(originalAmount);
            backGift=rem.multiply(java.math.BigInteger.valueOf(hold.getFromGift())).divide(original).longValueExact();
            long giftAndLicense=rem.multiply(java.math.BigInteger.valueOf(hold.getFromGift()+hold.getFromLicense())).divide(original).longValueExact();
            backLicense=giftAndLicense-backGift;
            backRecharge=com.aistareco.aep.enterprise.service.EnterpriseCreditLotService.remainingRecharge(hold,remaining);
        } else {
            // 按比例。最后一项用 remaining - 前两项保证总和恰好等于 remaining（避免 round 误差）。
            backGift = java.math.BigInteger.valueOf(remaining).multiply(java.math.BigInteger.valueOf(hold.getFromGift())).divide(java.math.BigInteger.valueOf(originalAmount)).longValueExact();
            backLicense = java.math.BigInteger.valueOf(remaining).multiply(java.math.BigInteger.valueOf(hold.getFromLicense())).divide(java.math.BigInteger.valueOf(originalAmount)).longValueExact();
            backRecharge = remaining - backGift - backLicense;
        }

        wallet.setGiftBalance(wallet.getGiftBalance() + backGift);
        wallet.setLicenseBalance(wallet.getLicenseBalance() + backLicense);
        wallet.setRechargeBalance(wallet.getRechargeBalance() + backRecharge);
        wallet.setTotalBalance(wallet.getTotalBalance() + remaining);
        if(wallet.getPendingBalance()<remaining) throw new ResponseStatusException(HttpStatus.CONFLICT,"钱包冻结余额与任务不一致，请核对");
        wallet.setPendingBalance(wallet.getPendingBalance() - remaining);
        wallet.setUpdatedAt(now);
        walletRepo.save(wallet);

        LedgerEntry entry = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(hold.getUserId())
                .actorUserId(hold.getActorUserId()).enterpriseId(hold.getEnterpriseId())
                .membershipId(hold.getMembershipId()).billingAuthorizationId(hold.getBillingAuthorizationId())
                .entryType(LedgerEntry.LedgerEntryType.UNFREEZE)
                .amount(remaining)
                .balanceAfter(wallet.getTotalBalance())
                .description(description)
                .referenceId(hold.getReferenceId())
                .referenceType(hold.getReferenceType())
                .createdAt(now)
                .build();
        // Nothing ordinary to return (the grant release has its own SCOPED_RELEASE row): no "unfreeze 0".
        boolean recorded=!modelCharge||remaining>0;
        if(recorded)ledgerRepo.save(entry);

        if(hold.getEnterpriseId()!=null) enterpriseCreditLots.release(hold);
        if(hold.getEnterpriseId()!=null && enterpriseRecovery!=null)
            enterpriseRecovery.afterRelease(hold,remaining,backGift,backLicense,backRecharge);
        return recorded?LedgerEntryDto.from(entry):null;
    }


    /** Provider calls must mark reservations before dispatch so uncertain failures cannot replenish supplier capacity. */
    @Transactional
    public void markModelDispatched(String referenceType,String referenceId) {
        lockReferencedWallet(referenceType,referenceId);
        var hold=holdRepo.findByReferenceTypeAndReferenceIdForUpdate(referenceType,referenceId).orElse(null);
        if(hold==null)return;
        refreshLocked(hold);
        if(hold.getStatus()!=CreditHold.Status.ACTIVE)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"任务冻结已结束，不能再次提交");
        if(modelCharges!=null && modelCharges.isModelCharge(hold.getId()))modelCharges.markDispatched(hold.getId(),Instant.now());
    }

    /** Server-measured successful supplier usage. Must join the job's terminal settlement transaction. */
    @Transactional(propagation=org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void finishModelResources(String referenceType,String referenceId,java.math.BigDecimal measuredUsage) {
        java.util.Objects.requireNonNull(measuredUsage,"Actual provider usage is required");
        lockReferencedWallet(referenceType,referenceId);
        var hold=holdRepo.findByReferenceTypeAndReferenceIdForUpdate(referenceType,referenceId).orElse(null);
        if(hold==null)return;
        refreshLocked(hold);
        if(hold.getStatus()==CreditHold.Status.ACTIVE && modelCharges!=null && modelCharges.isModelCharge(hold.getId()))
            modelCharges.finishResources(hold.getId(),measuredUsage,Instant.now());
    }

    /** Internal account creation: serialized by EnterpriseService's enterprise/user locks. */
    @Transactional
    public Wallet openEnterpriseWallet(String enterpriseId, String memberUserId) {
        if(enterpriseId==null || enterpriseId.isBlank()) throw new IllegalArgumentException("企业不能为空");
        String type=memberUserId==null?"enterprise":"enterprise_member";
        String key=type+":"+enterpriseId+(memberUserId==null?"":":"+memberUserId);
        return walletRepo.findByAccountKey(key).orElseGet(()->walletRepo.saveAndFlush(Wallet.builder()
                .id(UUID.randomUUID().toString()).accountType(type).accountKey(key).enterpriseId(enterpriseId)
                .memberUserId(memberUserId).createdAt(Instant.now()).updatedAt(Instant.now()).build()));
    }

    /** Internal enterprise-only transfer. Caller owns RBAC, enterprise lock and the batch record. */
    public record EnterpriseCreditTransfer(String outLedgerId, String inLedgerId,
                                          long fromGift, long fromLicense, long fromRecharge) {}

    @Transactional
    public EnterpriseCreditTransfer transferEnterpriseCredits(String enterpriseId, String fromWalletId,
            String toWalletId, long amount, String actorUserId, String membershipId, String transferId, String description) {
        return transferEnterpriseCreditsLocked(enterpriseId,fromWalletId,toWalletId,amount,actorUserId,membershipId,transferId,description,false,null,null,null);
    }

    /** Refund collection moves only cash-backed available credits; gift/license are never substituted. */
    @Transactional
    public EnterpriseCreditTransfer transferEnterpriseRechargeCredits(String enterpriseId, String fromWalletId,
            String toWalletId, long amount, String actorUserId, String membershipId, String transferId, String description) {
        return transferEnterpriseCreditsLocked(enterpriseId,fromWalletId,toWalletId,amount,actorUserId,membershipId,transferId,description,true,null,null,null);
    }

    @Transactional
    public EnterpriseCreditTransfer transferEnterpriseRechargeCredits(String enterpriseId, String fromWalletId,
            String toWalletId, long amount, String actorUserId, String membershipId, String transferId, String description,
            String sourceOrderId) {
        return transferEnterpriseCreditsLocked(enterpriseId,fromWalletId,toWalletId,amount,actorUserId,membershipId,transferId,description,true,sourceOrderId,null,null);
    }
    /** Recover only this old hold's released buckets and original recharge lots, preserving a new membership's allocation. */
    @Transactional
    public EnterpriseCreditTransfer transferEnterpriseReleasedCredits(CreditHold source,String toWalletId,long gift,long license,long recharge,
            String actor,String transferId,String description) {
        return transferEnterpriseCreditsLocked(source.getEnterpriseId(),source.getWalletId(),toWalletId,Math.addExact(Math.addExact(gift,license),recharge),
                actor,source.getMembershipId(),transferId,description,false,null,new long[]{gift,license,recharge},source);
    }

    private EnterpriseCreditTransfer transferEnterpriseCreditsLocked(String enterpriseId, String fromWalletId,
            String toWalletId, long amount, String actorUserId, String membershipId, String transferId,
            String description, boolean rechargeOnly,String sourceOrderId,long[] exactBuckets,CreditHold sourceHold) {
        if (enterpriseId==null || enterpriseId.isBlank() || amount<=0 || fromWalletId==null || toWalletId==null
                || fromWalletId.equals(toWalletId) || transferId==null || transferId.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"企业积分划拨参数无效");
        lockEnterpriseMoney(enterpriseId);
        // Match hold/settlement locks. Batch callers first lock the complete sorted set, never root-first.
        var locked=new java.util.HashMap<String,Wallet>();
        for(String walletId:java.util.stream.Stream.of(fromWalletId,toWalletId).sorted().toList()) {
            Wallet wallet=requiredWalletForUpdate(walletId);
            locked.put(walletId,wallet);
        }
        Wallet from=locked.get(fromWalletId),to=locked.get(toWalletId);
        boolean outward="enterprise".equals(from.getAccountType()) && "enterprise_member".equals(to.getAccountType());
        boolean inward="enterprise_member".equals(from.getAccountType()) && "enterprise".equals(to.getAccountType());
        if (!enterpriseId.equals(from.getEnterpriseId()) || !enterpriseId.equals(to.getEnterpriseId())
                || (!outward&&!inward) || (rechargeOnly&&!inward))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"只允许同企业主账户与成员企业账户间划拨");
        if (ledgerRepo.existsByReferenceTypeAndReferenceId("enterprise_transfer",transferId))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"积分划拨已执行");
        if ((rechargeOnly?from.getRechargeBalance():from.getTotalBalance())<amount)
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED,"可用企业积分不足，冻结积分不可回收");
        long fromGift=exactBuckets!=null?exactBuckets[0]:rechargeOnly?0:Math.min(from.getGiftBalance(),amount);
        long fromLicense=exactBuckets!=null?exactBuckets[1]:rechargeOnly?0:Math.min(from.getLicenseBalance(),amount-fromGift);
        long fromRecharge=exactBuckets!=null?exactBuckets[2]:amount-fromGift-fromLicense;
        if(fromGift<0||fromLicense<0||fromRecharge<0||from.getGiftBalance()<fromGift||from.getLicenseBalance()<fromLicense||from.getRechargeBalance()<fromRecharge)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"原任务退回的积分来源与账户不一致");
        long toTotal=Math.addExact(to.getTotalBalance(),amount);
        long toGift=Math.addExact(to.getGiftBalance(),fromGift);
        long toLicense=Math.addExact(to.getLicenseBalance(),fromLicense);
        long toRecharge=Math.addExact(to.getRechargeBalance(),fromRecharge);
        from.setGiftBalance(from.getGiftBalance()-fromGift);from.setLicenseBalance(from.getLicenseBalance()-fromLicense);
        from.setRechargeBalance(from.getRechargeBalance()-fromRecharge);from.setTotalBalance(from.getTotalBalance()-amount);
        to.setGiftBalance(toGift);to.setLicenseBalance(toLicense);to.setRechargeBalance(toRecharge);to.setTotalBalance(toTotal);
        Instant now=Instant.now();from.setUpdatedAt(now);to.setUpdatedAt(now);
        walletRepo.saveAndFlush(from);walletRepo.saveAndFlush(to);
        if(fromRecharge>0) {if(sourceHold!=null)enterpriseCreditLots.moveReleased(from,to,sourceHold);else enterpriseCreditLots.move(from,to,fromRecharge,sourceOrderId);}
        LedgerEntry out=enterpriseTransferLedger(from,-amount,LedgerEntry.LedgerEntryType.TRANSFER_OUT,
                actorUserId,membershipId,transferId,description,now);
        LedgerEntry in=enterpriseTransferLedger(to,amount,LedgerEntry.LedgerEntryType.TRANSFER_IN,
                actorUserId,membershipId,transferId,description,now);
        return new EnterpriseCreditTransfer(out.getId(),in.getId(),fromGift,fromLicense,fromRecharge);
    }

    private LedgerEntry enterpriseTransferLedger(Wallet wallet,long amount,LedgerEntry.LedgerEntryType type,
            String actor,String membershipId,String transferId,String description,Instant now) {
        return ledgerRepo.saveAndFlush(LedgerEntry.builder().id(UUID.randomUUID().toString()).walletId(wallet.getId())
                .userId(null).enterpriseId(wallet.getEnterpriseId()).actorUserId(actor).membershipId(membershipId)
                .entryType(type).amount(amount).balanceAfter(wallet.getTotalBalance()).description(description)
                .referenceType("enterprise_transfer").referenceId(transferId).createdAt(now).build());
    }

    /** Exact enterprise cash refund debit; unlike legacy personal refunds no silent clamp is permitted. */
    @Transactional
    public LedgerEntryDto refundCashReclaimWallet(String walletId,long requestedCredits,String cashArtifactId,String description) {
        if(requestedCredits<=0 || cashArtifactId==null || cashArtifactId.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"退款回收参数无效");
        Wallet wallet=requiredWalletForUpdate(walletId);
        if(!"enterprise".equals(wallet.getAccountType()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"企业现金退款仅能扣回企业主账户");
        if(wallet.getRechargeBalance()<requestedCredits)
            throw new ResponseStatusException(HttpStatus.CONFLICT,"可退充值积分不足，不能回收已消费或冻结积分");
        if(ledgerRepo.existsByReferenceTypeAndReferenceId("refund_cash",cashArtifactId))
            throw new ResponseStatusException(HttpStatus.CONFLICT,"退款积分已回收");
        wallet.setRechargeBalance(wallet.getRechargeBalance()-requestedCredits);
        wallet.setTotalBalance(wallet.getTotalBalance()-requestedCredits);wallet.setUpdatedAt(Instant.now());walletRepo.saveAndFlush(wallet);
        return LedgerEntryDto.from(ledgerRepo.saveAndFlush(LedgerEntry.builder().id(UUID.randomUUID().toString())
                .walletId(wallet.getId()).enterpriseId(wallet.getEnterpriseId()).entryType(LedgerEntry.LedgerEntryType.REFUND_CASH)
                .amount(-requestedCredits).balanceAfter(wallet.getTotalBalance()).description(description)
                .referenceType("refund_cash").referenceId(cashArtifactId).createdAt(Instant.now()).build()));
    }

    private Wallet requiredWalletForUpdate(String walletId) {
        Wallet wallet=walletRepo.findByIdForUpdate(walletId).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"钱包不存在"));
        refreshLocked(wallet);
        return wallet;
    }

    /** A locking SELECT does not overwrite an already-managed entity in Hibernate's first-level cache. */
    private void refreshLocked(Object entity) {
        if(entity!=null && enterpriseEntityManager!=null)
            enterpriseEntityManager.refresh(entity,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
    }

    private void lockReferencedWallet(String referenceType,String referenceId) {
        holdRepo.findByReferenceTypeAndReferenceId(referenceType,referenceId)
                .ifPresent(h->{if(h.getEnterpriseId()!=null)lockEnterpriseMoney(h.getEnterpriseId());requiredWalletForUpdate(h.getWalletId());});
    }
    /** Enterprise serializes authorization, lifecycle, transfers and settlement before any wallet/hold row. */
    private void lockEnterpriseMoney(String enterpriseId) {
        if(enterpriseId==null||enterpriseEntityManager==null)return;
        var e=enterpriseEntityManager.find(com.aistareco.aep.enterprise.model.Enterprise.class,enterpriseId,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        if(e==null)throw new ResponseStatusException(HttpStatus.CONFLICT,"原企业记录不存在，不能结算");
        enterpriseEntityManager.refresh(e,jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        var rows=enterpriseEntityManager.createQuery("select w from Wallet w where w.enterpriseId=:enterprise order by w.id",Wallet.class)
                .setParameter("enterprise",enterpriseId).setLockMode(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE).getResultList();
        rows.forEach(this::refreshLocked);
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
     * 实体级 wallet 取数 + 悲观行锁（v2 §5）。必须在 {@code @Transactional} 内调用。
     * 写余额路径（入账 / 扣减 / 冻结 / 解冻）用本方法串行化对同一钱包的并发写，防 lost update。
     * 钱包不存在时新建（新行在本事务内即受保护，其它事务同 userId 插入会撞唯一约束）。
     */
    private Wallet getOrCreateWalletForUpdate(String userId) {
        return walletRepo.findByUserIdForUpdate(userId).map(wallet->{refreshLocked(wallet);return wallet;}).orElseGet(() -> walletRepo.save(Wallet.builder()
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
     * admin 结算中心消费：附带账号登录名 / 昵称（v0.58，批量查询避免 N+1）。
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
        Map<String, AepUser> users = usersByIds(page.map(LedgerEntry::getUserId).toList());
        return page.map(e -> LedgerEntryDto.from(e, e.getUserId()==null?null:users.get(e.getUserId())));
    }

    /** 按 id 批量取用户（去重 + 过滤 null），DTO enrich 用。 */
    private Map<String, AepUser> usersByIds(java.util.List<String> ids) {
        java.util.Set<String> distinct = new java.util.HashSet<>();
        for (String id : ids) {
            if (id != null && !id.isBlank()) distinct.add(id);
        }
        if (distinct.isEmpty()) return Map.of();
        Map<String, AepUser> out = new java.util.HashMap<>();
        for (AepUser u : userRepo.findAllById(distinct)) {
            out.put(u.getId(), u);
        }
        return out;
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
