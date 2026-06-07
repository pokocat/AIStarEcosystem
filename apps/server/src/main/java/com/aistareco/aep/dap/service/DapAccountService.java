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

    public DapAccountService(CreditService creditService,
                             LedgerEntryRepository ledgerRepo,
                             DapJobRepository jobRepo,
                             DapAvatarRepository avatarRepo,
                             DapLookRepository lookRepo,
                             DapDerivativeRepository derivRepo,
                             DapVoiceRepository voiceRepo,
                             DapCaptureRepository captureRepo,
                             DapPhotoRepository photoRepo,
                             DapProperties props) {
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

        long perAvatar = Math.max(1, props.getPricing().getGenerate());
        long generatable = credits / perAvatar;

        LocalDate monthEnd = YearMonth.now(ZONE).atEndOfMonth();
        String refreshDate = DateTimeFormatter.ofPattern("M 月 d 日").format(monthEnd);

        // 分类占用（GB，1 位小数）
        double atlasGB = gb(sumAvatarImageBytes(userId) + lookRepo.sumBytesByOwner(userId)
                + derivRepo.sumBytesByOwnerAndKind(userId, "image"));
        double videoGB = gb(derivRepo.sumBytesByOwnerAndKind(userId, "video"));
        double d3GB = gb(derivRepo.sumBytesByOwnerAndKind(userId, "model3d"));
        double voiceGB = gb(voiceRepo.sumBytesByOwner(userId));
        double licGB = gb(captureRepo.sumBytesByOwner(userId) + photoRepo.sumBytesByOwner(userId));
        double used = round1(atlasGB + videoGB + d3GB + voiceGB + licGB);

        List<StorageSliceDto> breakdown = List.of(
                new StorageSliceDto("形象图集", atlasGB, "var(--primary)", "image"),
                new StorageSliceDto("衍生视频", videoGB, "#1AA06E", "film"),
                new StorageSliceDto("3D 资产", d3GB, "#D9920E", "cube"),
                new StorageSliceDto("声音文件", voiceGB, "#8A6BFF", "mic"),
                new StorageSliceDto("授权素材", licGB, "var(--ink-3)", "shield"));

        return new AccountDto("PRO", "PRO", credits, monthlyGrant, creditsUsed,
                refreshDate, generatable, used, 200, breakdown);
    }

    private long sumAvatarImageBytes(String userId) {
        return avatarRepo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId).stream()
                .mapToLong(a -> a.getImageBytes())
                .sum();
    }

    private static double gb(long bytes) {
        return round1(bytes / 1024.0 / 1024.0 / 1024.0);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
