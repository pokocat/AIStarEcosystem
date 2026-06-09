package com.aistareco.aep.dap.service;

import com.aistareco.aep.dap.config.DapProperties;
import com.aistareco.aep.dap.dto.DapDtos.AccountDto;
import com.aistareco.aep.dap.dto.DapDtos.StorageSliceDto;
import com.aistareco.aep.dap.repository.DapAvatarRepository;
import com.aistareco.aep.dap.repository.DapCaptureRepository;
import com.aistareco.aep.dap.repository.DapDerivativeRepository;
import com.aistareco.aep.dap.repository.DapJobRepository;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.dap.repository.DapPhotoRepository;
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
        long atlasMb = mb(sumAvatarImageBytes(userId) + lookRepo.sumBytesByOwner(userId)
                + derivRepo.sumBytesByOwnerAndKind(userId, "image"));
        long videoMb = mb(derivRepo.sumBytesByOwnerAndKind(userId, "video"));
        long d3Mb = mb(derivRepo.sumBytesByOwnerAndKind(userId, "model3d"));
        long voiceMb = mb(voiceRepo.sumBytesByOwner(userId));
        long licMb = mb(captureRepo.sumBytesByOwner(userId) + photoRepo.sumBytesByOwner(userId));
        long usedMb = atlasMb + videoMb + d3Mb + voiceMb + licMb;
        int quotaMb = props.getStorageQuotaMb();

        List<StorageSliceDto> breakdown = List.of(
                new StorageSliceDto("形象图集", atlasMb, "var(--primary)", "image"),
                new StorageSliceDto("衍生视频", videoMb, "#1AA06E", "film"),
                new StorageSliceDto("3D 资产", d3Mb, "#D9920E", "cube"),
                new StorageSliceDto("声音文件", voiceMb, "#8A6BFF", "mic"),
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
