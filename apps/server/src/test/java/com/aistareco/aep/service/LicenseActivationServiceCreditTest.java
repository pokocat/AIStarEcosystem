package com.aistareco.aep.service;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.LicenseBatch;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.model.Membership;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.LicenseBatchRepository;
import com.aistareco.aep.repository.LicenseKeyRepository;
import com.aistareco.aep.repository.MembershipRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.aep.repository.TenantRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 例行 QA（2026-07-02）回归测试：activateForExistingUser 追加激活积分发放
 * 必须走 CreditService.creditAccount（悲观行锁），不得再对 Wallet 做
 * 无锁 findByUserId + 直接 save 的 read-modify-write（AGENTS.md §4.2 / lost-update 修复）。
 */
class LicenseActivationServiceCreditTest {

    private LicenseKeyRepository keyRepo;
    private LicenseBatchRepository batchRepo;
    private AepUserRepository userRepo;
    private TenantRepository tenantRepo;
    private MembershipRepository membershipRepo;
    private WalletRepository walletRepo;
    private LedgerEntryRepository ledgerRepo;
    private StudioRepository studioRepo;
    private JwtUtil jwtUtil;
    private PlatformAccessService platformAccessService;
    private NotificationPublisher notificationPublisher;
    private CreditService creditService;
    private LicenseActivationService service;

    private static final String RAW_CODE = "TEST-CODE-1234";

    @BeforeEach
    void setUp() {
        keyRepo = mock(LicenseKeyRepository.class);
        batchRepo = mock(LicenseBatchRepository.class);
        userRepo = mock(AepUserRepository.class);
        tenantRepo = mock(TenantRepository.class);
        membershipRepo = mock(MembershipRepository.class);
        walletRepo = mock(WalletRepository.class);
        ledgerRepo = mock(LedgerEntryRepository.class);
        studioRepo = mock(StudioRepository.class);
        jwtUtil = mock(JwtUtil.class);
        platformAccessService = mock(PlatformAccessService.class);
        notificationPublisher = mock(NotificationPublisher.class);
        creditService = mock(CreditService.class);
        service = new LicenseActivationService(keyRepo, batchRepo, userRepo, tenantRepo,
                membershipRepo, walletRepo, ledgerRepo, studioRepo, jwtUtil,
                platformAccessService, notificationPublisher, creditService);

        AepUser user = AepUser.builder().id("u1").platforms(null).build();
        when(userRepo.findById("u1")).thenReturn(Optional.of(user));
        when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        LicenseKey key = LicenseKey.builder()
                .id("key1").batchId("batch1").codeHash(sha256(RAW_CODE.toUpperCase()))
                .status(LicenseKey.LicenseKeyStatus.CREATED)
                .build();
        when(keyRepo.findByCodeHash(anyString())).thenReturn(Optional.of(key));
        when(keyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        LicenseBatch batch = LicenseBatch.builder()
                .id("batch1").issuerTenantId(null).platforms(null)
                .initialCreditGrant(500L).totalCount(100).activatedCount(0)
                .status(LicenseBatch.LicenseBatchStatus.ACTIVE)
                .build();
        when(batchRepo.findById("batch1")).thenReturn(Optional.of(batch));
        when(batchRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        when(membershipRepo.findByUserId("u1")).thenReturn(java.util.List.of());

        when(creditService.creditAccount(eq("u1"), eq(500L), eq(LedgerEntry.LedgerEntryType.LICENSE_GRANT),
                eq("license_key"), eq("key1"), anyString()))
                .thenReturn(new LedgerEntryDto("le1", "w1", "u1", null, null, null,
                        "license_grant", 500L, 1500L, "追加激活秘钥发放积分",
                        "key1", "license_key", Instant.now()));
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @Test
    void appendActivation_routesCreditGrantThroughCreditService_notDirectWalletWrite() {
        Map<String, Object> resp = service.activateForExistingUser("u1", RAW_CODE);

        verify(creditService).creditAccount("u1", 500L, LedgerEntry.LedgerEntryType.LICENSE_GRANT,
                "license_key", "key1", "追加激活秘钥发放积分");
        // 悲观行锁串行化并发写余额是 CreditService 内部保证的——追加激活路径不应再自己
        // 对 Wallet 做无锁 read-modify-write（lost-update 根因）。
        verify(walletRepo, never()).save(any(Wallet.class));
        assertEquals(1500L, resp.get("newTotalBalance"));
        assertEquals(500L, resp.get("creditsGranted"));
    }
}
