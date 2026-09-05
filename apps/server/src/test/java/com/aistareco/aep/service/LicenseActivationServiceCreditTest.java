package com.aistareco.aep.service;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.enrollment.model.ProductEnrollment;
import com.aistareco.aep.enrollment.repository.EntitlementGrantRepository;
import com.aistareco.aep.enrollment.repository.ProductEnrollmentRepository;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.LicenseBatch;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.LicenseBatchRepository;
import com.aistareco.aep.repository.LicenseKeyRepository;
import com.aistareco.aep.repository.MembershipRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.aep.repository.TenantRepository;
import com.aistareco.aep.repository.WalletRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 例行 QA（2026-07-02）回归测试：追加激活的积分发放必须走 CreditService.creditAccount
 * （悲观行锁），不得再对 Wallet 做无锁 findByUserId + 直接 save 的 read-modify-write
 * （AGENTS.md §4.2 / lost-update 修复）。
 *
 * <p>v0.149：兑换实现下沉到 {@link EnrollmentService}，本测试跟着改成「LicenseActivationService
 * 经 EnrollmentService 兑换」的组合，断言不变 —— 这条不变量守的是钱，不能随重构丢掉。</p>
 */
class LicenseActivationServiceCreditTest {

    private LicenseKeyRepository keyRepo;
    private LicenseBatchRepository batchRepo;
    private AepUserRepository userRepo;
    private TenantRepository tenantRepo;
    private MembershipRepository membershipRepo;
    private WalletRepository walletRepo;
    private StudioRepository studioRepo;
    private JwtUtil jwtUtil;
    private PlatformAccessService platformAccessService;
    private NotificationPublisher notificationPublisher;
    private CreditService creditService;
    private ProductEnrollmentRepository enrollmentRepo;
    private EntitlementGrantRepository grantRepo;
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
        studioRepo = mock(StudioRepository.class);
        jwtUtil = mock(JwtUtil.class);
        platformAccessService = mock(PlatformAccessService.class);
        notificationPublisher = mock(NotificationPublisher.class);
        creditService = mock(CreditService.class);
        enrollmentRepo = mock(ProductEnrollmentRepository.class);
        grantRepo = mock(EntitlementGrantRepository.class);

        EnrollmentService enrollmentService = new EnrollmentService(enrollmentRepo, grantRepo,
                keyRepo, batchRepo, userRepo, studioRepo, tenantRepo, walletRepo, creditService,
                platformAccessService, mock(ApplicationEventPublisher.class));
        service = new LicenseActivationService(userRepo, membershipRepo, studioRepo, jwtUtil,
                notificationPublisher, enrollmentService);

        AepUser user = AepUser.builder().id("u1").username("u1").platforms(null).build();
        when(userRepo.findById("u1")).thenReturn(Optional.of(user));
        when(userRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        LicenseKey key = LicenseKey.builder()
                .id("key1").batchId("batch1").codeHash(sha256(RAW_CODE.toUpperCase()))
                .status(LicenseKey.LicenseKeyStatus.CREATED)
                .build();
        when(keyRepo.findByCodeHash(anyString())).thenReturn(Optional.of(key));
        when(keyRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        // 条件更新占码：本测试模拟「抢到」
        when(keyRepo.claimForActivation(eq("key1"), eq("u1"), any(), any(), any())).thenReturn(1);

        LicenseBatch batch = LicenseBatch.builder()
                .id("batch1").issuerTenantId(null).platforms(null)
                .initialCreditGrant(500L).totalCount(100).activatedCount(0)
                .status(LicenseBatch.LicenseBatchStatus.ACTIVE)
                .build();
        when(batchRepo.findById("batch1")).thenReturn(Optional.of(batch));
        when(batchRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        when(membershipRepo.findByUserId("u1")).thenReturn(java.util.List.of());
        when(studioRepo.findByOwnerUserId("u1")).thenReturn(Optional.of(
                Studio.builder().id("s1").ownerUserId("u1").build()));
        when(platformAccessService.grantedCsvForNewUser(any()))
                .thenReturn(PlatformSupport.toCsv(PlatformSupport.ALL));
        when(grantRepo.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(enrollmentRepo.findByUserIdAndProduct(anyString(), anyString())).thenReturn(Optional.empty());
        when(enrollmentRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(walletRepo.findByUserId("u1")).thenReturn(Optional.of(
                Wallet.builder().id("w1").userId("u1").totalBalance(1000L).build()));

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

    @Test
    void appendActivation_claimsKeyConditionally_andWritesEntitlementGrantAndEnrollments() {
        service.activateForExistingUser("u1", RAW_CODE);

        // 占码必须走条件更新（WHERE status='CREATED'），不能是读-改-写
        verify(keyRepo).claimForActivation(eq("key1"), eq("u1"), any(),
                eq(LicenseKey.LicenseKeyStatus.CREATED), eq(LicenseKey.LicenseKeyStatus.ACTIVATED));
        verify(keyRepo, never()).save(any(LicenseKey.class));
        // 权益凭据（唯一约束防重复兑换）+ 五个子产品的开通记录。
        // v0.150：凭据按产品逐条写（UNIQUE 三元组 (source, source_reference, product)），
        // 这把全站秘钥开五个产品就是五条 —— 日后按产品退权 / 对账才有据可依。
        verify(grantRepo, org.mockito.Mockito.times(PlatformSupport.ALL.size())).saveAndFlush(any());
        verify(enrollmentRepo, org.mockito.Mockito.times(PlatformSupport.ALL.size()))
                .save(any(ProductEnrollment.class));
    }
}
