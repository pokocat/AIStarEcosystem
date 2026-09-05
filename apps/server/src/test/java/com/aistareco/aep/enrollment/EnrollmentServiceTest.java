package com.aistareco.aep.enrollment;

import com.aistareco.aep.dto.EnrollmentDto;
import com.aistareco.aep.dto.MeDto;
import com.aistareco.aep.enrollment.config.EnrollmentBackfill;
import com.aistareco.aep.enrollment.model.EntitlementGrant;
import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentSource;
import com.aistareco.aep.enrollment.repository.EntitlementGrantRepository;
import com.aistareco.aep.enrollment.repository.ProductEnrollmentRepository;
import com.aistareco.aep.enrollment.service.EnrollmentService;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.LicenseBatch;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.LicenseBatchRepository;
import com.aistareco.aep.repository.LicenseKeyRepository;
import com.aistareco.aep.repository.WalletRepository;
import com.aistareco.aep.service.AccountSelfService;
import com.aistareco.aep.service.PlatformSupport;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * 子产品开通（v0.149，docs/unified-identity-plan.md §12.2）的真实集成验证：
 * 激活码兑换 happy path、重复兑换、并发兑换只有一方赢、回填幂等、/api/me 带上开通记录。
 *
 * <p>不加类级 {@code @Transactional}：并发用例需要每线程真实提交的独立事务，
 * 才能让「条件更新占码」的行锁真正串行化。各用例用唯一 userId / key 互不干扰。</p>
 */
@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:enrollment-svc;MODE=MySQL;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=20000",
        "spring.jpa.hibernate.ddl-auto=update",
        "aep.seed.dev-data.enabled=false",
        "aep.cdn.driver=local"
})
class EnrollmentServiceTest {

    @Autowired private EnrollmentService enrollmentService;
    @Autowired private ProductEnrollmentRepository enrollmentRepo;
    @Autowired private EntitlementGrantRepository grantRepo;
    @Autowired private LicenseKeyRepository keyRepo;
    @Autowired private LicenseBatchRepository batchRepo;
    @Autowired private AepUserRepository userRepo;
    @Autowired private WalletRepository walletRepo;
    @Autowired private AccountSelfService accountSelfService;
    @Autowired private EnrollmentBackfill backfill;

    // ── fixtures ──────────────────────────────────────────────────────────────

    private AepUser newUser(String platformsCsv) {
        Instant now = Instant.now();
        String id = "eu-" + UUID.randomUUID();
        return userRepo.save(AepUser.builder()
                .id(id).username(id)
                .kind(AepUser.AccountKind.STUDIO)
                .status(AepUser.UserStatus.ACTIVE)
                .platforms(platformsCsv)
                .emailVerified(false).phoneVerified(false)
                .createdAt(now).updatedAt(now)
                .build());
    }

    /** @param platforms 批次限定的子产品 CSV；null = 全站秘钥 */
    private String newLicenseCode(String platforms, long credits) {
        String batchId = "eb-" + UUID.randomUUID();
        batchRepo.save(LicenseBatch.builder()
                .id(batchId).batchNo(batchId).name("测试批次")
                .platforms(platforms)
                .initialCreditGrant(credits).totalCount(100).activatedCount(0)
                .status(LicenseBatch.LicenseBatchStatus.ACTIVE)
                .createdAt(Instant.now())
                .build());
        String raw = ("EK-" + UUID.randomUUID()).toUpperCase();
        keyRepo.save(LicenseKey.builder()
                .id("ek-" + UUID.randomUUID()).batchId(batchId)
                .codeHash(sha256(raw)).maskedCode("EK-****")
                .status(LicenseKey.LicenseKeyStatus.CREATED)
                .createdAt(Instant.now())
                .build());
        return raw;
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    // ── 激活 ─────────────────────────────────────────────────────────────────

    @Test
    void activateWithLicense_opensProduct_grantsCredits_andWritesEntitlement() {
        AepUser user = newUser("music");
        String code = newLicenseCode("drama", 800);

        EnrollmentDto dto = enrollmentService.activateWithLicense(user.getId(), "drama", code);

        assertEquals("drama", dto.product());
        assertEquals("active", dto.status());
        assertEquals("license", dto.source());
        assertTrue(enrollmentService.isActive(user.getId(), "drama"));
        assertFalse(enrollmentService.isActive(user.getId(), "celebrity"));
        assertEquals(800L, walletRepo.findByUserId(user.getId()).orElseThrow().getTotalBalance());
        assertEquals(1, grantRepo.findByUserIdOrderByGrantedAtAsc(user.getId()).size());
        // 旧 platforms CSV 兼容双写：music ∪ drama
        AepUser after = userRepo.findById(user.getId()).orElseThrow();
        assertEquals(List.of("music", "drama"), PlatformSupport.parse(after.getPlatforms()));
    }

    @Test
    void activateWithLicense_wholeSiteKey_opensAllProducts() {
        AepUser user = newUser(null);
        String code = newLicenseCode(null, 100);

        enrollmentService.activateWithLicense(user.getId(), "star", code);

        assertEquals(PlatformSupport.ALL, enrollmentService.activeProducts(user.getId()));
    }

    @Test
    void wholeSiteKey_writesOneGrantPerActivatedProduct() {
        AepUser user = newUser(null);
        String code = newLicenseCode(null, 100);

        enrollmentService.activateWithLicense(user.getId(), "star", code);

        String keyId = keyRepo.findByCodeHash(sha256(code)).orElseThrow().getId();
        List<EntitlementGrant> grants =
                grantRepo.findBySourceAndSourceReference(EnrollmentSource.LICENSE, keyId);
        List<String> opened = enrollmentService.activeProducts(user.getId());

        // v0.150：一把全站秘钥开几个产品就留几条凭据（此前只记「主产品」一条，
        // 日后要按产品分别退权 / 对账时无据可依）。
        assertTrue(opened.size() > 1, "全站秘钥应开通多个子产品");
        assertEquals(opened.size(), grants.size());
        assertEquals(opened, grants.stream()
                .map(EntitlementGrant::getProduct)
                .sorted(java.util.Comparator.comparingInt(PlatformSupport.ALL::indexOf))
                .toList());
    }

    @Test
    void activateWithLicense_unknownProduct_rejectedWithProductInvalid() {
        AepUser user = newUser(null);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> enrollmentService.activateWithLicense(user.getId(), "notaproduct", "whatever"));
        assertEquals("PRODUCT_INVALID", ex.getCode());
    }

    @Test
    void activateWithLicense_productOutsideBatchScope_rejected_andKeyNotBurned() {
        AepUser user = newUser(null);
        String code = newLicenseCode("aiavatar", 500);

        BusinessException ex = assertThrows(BusinessException.class,
                () -> enrollmentService.activateWithLicense(user.getId(), "music", code));
        assertEquals("LICENSE_KEY_PRODUCT_MISMATCH", ex.getCode());
        // 先判后占：码没被烧掉，还能用来开正确的子产品
        assertEquals(LicenseKey.LicenseKeyStatus.CREATED,
                keyRepo.findByCodeHash(sha256(code)).orElseThrow().getStatus());
        EnrollmentDto ok = enrollmentService.activateWithLicense(user.getId(), "aiavatar", code);
        assertEquals("active", ok.status());
    }

    @Test
    void doubleRedeem_secondAttemptConflicts_andOnlyOneGrantExists() {
        AepUser user = newUser(null);
        String code = newLicenseCode("music", 300);

        enrollmentService.activateWithLicense(user.getId(), "music", code);
        BusinessException ex = assertThrows(BusinessException.class,
                () -> enrollmentService.activateWithLicense(user.getId(), "music", code));
        assertEquals("LICENSE_KEY_UNAVAILABLE", ex.getCode());

        String keyId = keyRepo.findByCodeHash(sha256(code)).orElseThrow().getId();
        assertEquals(1, grantRepo.countBySourceAndSourceReference(EnrollmentSource.LICENSE, keyId),
                "同一把激活码只能留下一条权益凭据");
        assertEquals(300L, walletRepo.findByUserId(user.getId()).orElseThrow().getTotalBalance(),
                "重复兑换不得再发一份积分");
    }

    @Test
    void concurrentRedeem_exactlyOneWins() throws Exception {
        AepUser user = newUser(null);
        String code = newLicenseCode("celebrity", 700);

        int threads = 2;
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(threads);
        AtomicInteger ok = new AtomicInteger();
        AtomicInteger failed = new AtomicInteger();
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        for (int i = 0; i < threads; i++) {
            pool.submit(() -> {
                try {
                    start.await();
                    enrollmentService.activateWithLicense(user.getId(), "celebrity", code);
                    ok.incrementAndGet();
                } catch (Exception e) {
                    failed.incrementAndGet();
                } finally {
                    done.countDown();
                }
            });
        }
        start.countDown();
        assertTrue(done.await(30, TimeUnit.SECONDS), "并发兑换未在超时内结束");
        pool.shutdown();

        assertEquals(1, ok.get(), "同一把激活码并发兑换只能有一方成功");
        assertEquals(1, failed.get());
        String keyId = keyRepo.findByCodeHash(sha256(code)).orElseThrow().getId();
        assertEquals(1, grantRepo.countBySourceAndSourceReference(EnrollmentSource.LICENSE, keyId));
        assertEquals(700L, walletRepo.findByUserId(user.getId()).orElseThrow().getTotalBalance(),
                "并发下积分只能发一份");
    }

    // ── 回填 ─────────────────────────────────────────────────────────────────

    @Test
    void backfill_mapsLegacyCsv_andIsIdempotent() {
        AepUser withCsv = newUser("music,drama");
        AepUser blankCsv = newUser(null);

        backfill.backfill();
        List<EnrollmentDto> a = enrollmentService.listFor(withCsv.getId());
        List<EnrollmentDto> b = enrollmentService.listFor(blankCsv.getId());
        assertEquals(2, a.size());
        assertTrue(a.stream().allMatch(e -> "legacy".equals(e.source()) && "active".equals(e.status())));
        assertEquals(PlatformSupport.ALL.size(), b.size(), "空 CSV 的历史语义是全集");

        long before = enrollmentRepo.count();
        backfill.backfill();
        assertEquals(before, enrollmentRepo.count(), "回填必须幂等");
    }

    // ── /api/me ──────────────────────────────────────────────────────────────

    @Test
    void me_returnsEnrollments_andPlatformsDerivedFromThem() {
        AepUser user = newUser("music,drama,celebrity");
        String code = newLicenseCode("star", 0);
        enrollmentService.activateWithLicense(user.getId(), "star", code);

        MeDto me = accountSelfService.getCurrentMe(user.getId());
        assertEquals(1, me.enrollments().size(), "只有 star 开通过，其余产品尚无 enrollment 行");
        assertEquals("star", me.enrollments().get(0).product());
        assertEquals(List.of("star"), me.platforms(),
                "有 enrollment 行时 platforms 由 active 开通派生，不再读旧 CSV");
    }

    @Test
    void grantForNewUser_devGrantAll_opensAllProducts() {
        AepUser user = newUser(null);
        enrollmentService.grantForNewUser(user.getId(), "music");
        assertEquals(PlatformSupport.ALL, enrollmentService.activeProducts(user.getId()));
        assertTrue(enrollmentService.listFor(user.getId()).stream()
                .allMatch(e -> "grant_all".equals(e.source())));
    }

    @Test
    void expiredEnrollment_isNotActive() {
        AepUser user = newUser(null);
        enrollmentService.upsert(user.getId(), "music",
                com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentStatus.ACTIVE,
                EnrollmentSource.TRIAL, Instant.now().minusSeconds(60));
        assertFalse(enrollmentService.isActive(user.getId(), "music"), "过期开通等同未开通");
        // 但仍在 /api/me 的开通列表里（前端要能展示「已过期」）
        assertEquals(1, enrollmentService.listFor(user.getId()).size());
    }

    @Test
    void entitlementGrantIsImmutableRecord_withLicenseSourceReference() {
        AepUser user = newUser(null);
        String code = newLicenseCode("music", 50);
        enrollmentService.activateWithLicense(user.getId(), "music", code);

        EntitlementGrant grant = grantRepo.findByUserIdOrderByGrantedAtAsc(user.getId()).get(0);
        assertEquals(EnrollmentSource.LICENSE, grant.getSource());
        assertEquals(keyRepo.findByCodeHash(sha256(code)).orElseThrow().getId(), grant.getSourceReference());
        assertEquals(EntitlementGrant.GrantStatus.ACTIVE, grant.getStatus());
    }
}
