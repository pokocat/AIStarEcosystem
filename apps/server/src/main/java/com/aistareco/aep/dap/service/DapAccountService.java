package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.dto.DapDtos.AccountDto;
import com.aistareco.aep.dap.dto.DapDtos.StorageSliceDto;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapCompositionOutputRepository;
import com.aistareco.aep.dap.repository.DapDerivativeRepository;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.dap.repository.DapPhotoRepository;
import com.aistareco.aep.dap.repository.DapProductRepository;
import com.aistareco.aep.dap.repository.DapSceneRepository;
import com.aistareco.aep.dap.repository.DapVoiceRepository;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.service.CreditService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;

/** 账户 / 算力 / 存储用量（复用 aep_users 钱包 + LedgerEntry 不可变账本）。 */
@Service
public class DapAccountService {

    private static final Logger log = LoggerFactory.getLogger(DapAccountService.class);
    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final String GRANT_REF_TYPE = "dap-monthly-grant";

    private final CreditService creditService;
    private final LedgerEntryRepository ledgerRepo;
    private final DapJobRepository jobRepo;
    private final DapAvatarRepository avatarRepo;
    private final DapLookRepository lookRepo;
    private final DapDerivativeRepository derivRepo;
    private final DapVoiceRepository voiceRepo;
    private final DapCaptureRepository captureRepo;
    private final DapPhotoRepository photoRepo;
    private final DapSceneRepository sceneRepo;
    private final DapProductRepository productRepo;
    private final DapCompositionOutputRepository compositionOutputRepo;
    private final DapProperties props;
    private final DapPricingService pricing;

    public DapAccountService(CreditService creditService,
                             LedgerEntryRepository ledgerRepo,
                             DapJobRepository jobRepo,
                             DapAvatarRepository avatarRepo,
                             DapLookRepository lookRepo,
                             DapDerivativeRepository derivRepo,
                             DapVoiceRepository voiceRepo,
                             DapCaptureRepository captureRepo,
                             DapPhotoRepository photoRepo,
                             DapSceneRepository sceneRepo,
                             DapProductRepository productRepo,
                             DapCompositionOutputRepository compositionOutputRepo,
                             DapProperties props,
                             DapPricingService pricing) {
        this.creditService = creditService;
        this.ledgerRepo = ledgerRepo;
        this.jobRepo = jobRepo;
        this.avatarRepo = avatarRepo;
        this.lookRepo = lookRepo;
        this.derivRepo = derivRepo;
        this.voiceRepo = voiceRepo;
        this.captureRepo = captureRepo;
        this.photoRepo = photoRepo;
        this.sceneRepo = sceneRepo;
        this.productRepo = productRepo;
        this.compositionOutputRepo = compositionOutputRepo;
        this.props = props;
        this.pricing = pricing;
    }

    /** 月度赠送算力（幂等：referenceId = userId:yyyyMM 只发一次）。 */
    public void ensureMonthlyGrant(String userId) {
        long grant = props.getMonthlyGrant();
        if (grant <= 0) return;
        String ref = userId + ":" + YearMonth.now(ZONE);
        try {
            if (ledgerRepo.existsByReferenceTypeAndReferenceId(GRANT_REF_TYPE, ref)) return;
            creditService.creditAccount(userId, grant, LedgerEntry.LedgerEntryType.GIFT,
                    GRANT_REF_TYPE, ref, "数字人资产平台 · 月度赠送算力");
            log.info("[dap] monthly grant issued user={} amount={}", userId, grant);
        } catch (Exception e) {
            log.warn("[dap] monthly grant failed user={}: {}", userId, e.getMessage());
        }
    }

    public AccountDto account(String userId) {
        ensureMonthlyGrant(userId);
        Wallet wallet = creditService.getOrCreateWallet(userId);
        long credits = wallet.getTotalBalance();
        long monthlyGrant = props.getMonthlyGrant();

        var monthStart = YearMonth.now(ZONE).atDay(1).atStartOfDay(ZONE).toInstant();
        long creditsUsed = jobRepo.sumCostSince(userId, monthStart);

        long perAvatar = Math.max(1, pricing.generate()); // v0.53：admin 单价优先，env fallback
        long generatable = credits / perAvatar;

        LocalDate monthEnd = YearMonth.now(ZONE).atEndOfMonth();
        String refreshDate = DateTimeFormatter.ofPattern("M 月 d 日").format(monthEnd);

        // 分类占用（MB，四舍五入；非空分类不足 1MB 记 1MB）。used = 各分类之和，与下方分类条对齐。
        // v0.104：口径改为「六类资产 + 合成产物 + 授权素材」，与资产库的分类语言一致 ——
        // 人物（DH-）把定妆图 / 造型 / 图集衍生 / 视频 / 3D 合并成一项，另五类各自独立成项。
        long characterMb = mb(sumAvatarImageBytes(userId) + lookRepo.sumBytesByOwner(userId)
                + derivRepo.sumBytesByOwnerAndKind(userId, "image")
                + derivRepo.sumBytesByOwnerAndKind(userId, "video")
                + derivRepo.sumBytesByOwnerAndKind(userId, "model3d"));
        long sceneMb = mb(sceneRepo.sumBytesByOwner(userId));
        long productMb = mb(productRepo.sumBytesByOwner(userId));
        long voiceMb = mb(voiceRepo.sumBytesByOwner(userId));
        long composeMb = mb(compositionOutputRepo.sumBytesByOwner(userId));
        long licMb = mb(captureRepo.sumBytesByOwner(userId) + photoRepo.sumBytesByOwner(userId));
        long usedMb = characterMb + sceneMb + productMb + voiceMb + composeMb + licMb;
        int quotaMb = props.getStorageQuotaMb();

        // 风格模板（ST-）与 IP 容器（IP-）只是登记，没有独立文件体积，因此不单列分类条。
        List<StorageSliceDto> breakdown = List.of(
                new StorageSliceDto("人物 · DH-", characterMb, "var(--primary)", "user"),
                new StorageSliceDto("场景 · SC-", sceneMb, "#1AA06E", "image"),
                new StorageSliceDto("产品 · PD-", productMb, "#D9920E", "cube"),
                new StorageSliceDto("声音 · VO-", voiceMb, "#8A6BFF", "mic"),
                new StorageSliceDto("合成产物", composeMb, "#2BA6E8", "layers"),
                new StorageSliceDto("授权素材", licMb, "var(--ink-3)", "shield"));

        return new AccountDto("PRO", "PRO", credits, monthlyGrant, creditsUsed,
                refreshDate, generatable, usedMb, quotaMb, breakdown);
    }

    private long sumAvatarImageBytes(String userId) {
        return avatarRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId).stream()
                .mapToLong(a -> a.getImageBytes())
                .sum();
    }

    private static final long BYTES_PER_MB = 1024L * 1024L;

    /** 字节 → MB：四舍五入；&gt;0 但不足 1MB 记 1MB（账户用量展示口径）。 */
    private static long mb(long bytes) {
        if (bytes <= 0) return 0;
        return Math.max(1, Math.round((double) bytes / BYTES_PER_MB));
    }
}
