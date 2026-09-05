package com.aistareco.aep.enrollment.service;

import com.aistareco.aep.dto.EnrollmentDto;
import com.aistareco.aep.enrollment.event.EnrollmentActivatedEvent;
import com.aistareco.aep.enrollment.model.EntitlementGrant;
import com.aistareco.aep.enrollment.model.ProductEnrollment;
import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentSource;
import com.aistareco.aep.enrollment.model.ProductEnrollment.EnrollmentStatus;
import com.aistareco.aep.enrollment.repository.EntitlementGrantRepository;
import com.aistareco.aep.enrollment.repository.ProductEnrollmentRepository;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.LicenseBatch;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.LicenseBatchRepository;
import com.aistareco.aep.repository.LicenseKeyRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.aep.repository.TenantRepository;
import com.aistareco.aep.repository.WalletRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.aep.service.PlatformAccessService;
import com.aistareco.aep.service.PlatformSupport;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 子产品「开通」权益服务 —— 唯一的激活码兑换路径（docs/unified-identity-plan.md §12.2）。
 *
 * <p>三个入口最终都落到这里，保证「一把激活码只发一次积分、只开一次权益」：</p>
 * <ol>
 *   <li>{@code POST /api/auth/activate}（激活码注册新账号，legacy）</li>
 *   <li>{@code POST /api/me/license/activate}（已登录追加激活，legacy）</li>
 *   <li>{@code POST /api/me/enrollments/{product}/activate}（v0.149 新契约）</li>
 * </ol>
 *
 * <p>核销靠两道闸：① {@code license_key} 的条件更新（{@code WHERE status='CREATED'}，
 * 数据库行锁串行化并发）；② {@code entitlement_grant} 的 {@code UNIQUE(source, source_reference)}。
 * 任一道没过 → 409，绝不发第二份积分。</p>
 */
@Service
public class EnrollmentService {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentService.class);

    private final ProductEnrollmentRepository enrollmentRepo;
    private final EntitlementGrantRepository grantRepo;
    private final LicenseKeyRepository keyRepo;
    private final LicenseBatchRepository batchRepo;
    private final AepUserRepository userRepo;
    private final StudioRepository studioRepo;
    private final TenantRepository tenantRepo;
    private final WalletRepository walletRepo;
    private final CreditService creditService;
    private final PlatformAccessService platformAccessService;
    private final ApplicationEventPublisher events;

    public EnrollmentService(ProductEnrollmentRepository enrollmentRepo,
                             EntitlementGrantRepository grantRepo,
                             LicenseKeyRepository keyRepo,
                             LicenseBatchRepository batchRepo,
                             AepUserRepository userRepo,
                             StudioRepository studioRepo,
                             TenantRepository tenantRepo,
                             WalletRepository walletRepo,
                             CreditService creditService,
                             PlatformAccessService platformAccessService,
                             ApplicationEventPublisher events) {
        this.enrollmentRepo = enrollmentRepo;
        this.grantRepo = grantRepo;
        this.keyRepo = keyRepo;
        this.batchRepo = batchRepo;
        this.userRepo = userRepo;
        this.studioRepo = studioRepo;
        this.tenantRepo = tenantRepo;
        this.walletRepo = walletRepo;
        this.creditService = creditService;
        this.platformAccessService = platformAccessService;
        this.events = events;
    }

    // ── 读 ────────────────────────────────────────────────────────────────────

    /** 该账号全部开通记录（含 pending / suspended / revoked，供 /api/me 与开通页展示）。 */
    @Transactional(readOnly = true)
    public List<EnrollmentDto> listFor(String userId) {
        return enrollmentRepo.findByUserIdOrderByProductAsc(userId).stream()
                .map(EnrollmentService::toDto)
                .toList();
    }

    /** 该账号是否已开通某子产品：状态 ACTIVE 且未过有效期。 */
    @Transactional(readOnly = true)
    public boolean isActive(String userId, String product) {
        if (userId == null || product == null) return false;
        String normalized = product.trim().toLowerCase(Locale.ROOT);
        return enrollmentRepo.findByUserIdAndProduct(userId, normalized)
                .map(EnrollmentService::isActiveNow)
                .orElse(false);
    }

    /** 该账号已开通（ACTIVE 且未过期）的子产品列表，保持 {@code PlatformSupport.ALL} 的展示顺序。 */
    @Transactional(readOnly = true)
    public List<String> activeProducts(String userId) {
        List<String> active = enrollmentRepo.findByUserIdOrderByProductAsc(userId).stream()
                .filter(EnrollmentService::isActiveNow)
                .map(ProductEnrollment::getProduct)
                .toList();
        return PlatformSupport.ALL.stream().filter(active::contains).toList();
    }

    /** 该账号是否已有任何 enrollment 行（用于判断能否停止回落读旧 platforms CSV）。 */
    @Transactional(readOnly = true)
    public boolean hasAnyEnrollment(String userId) {
        return enrollmentRepo.existsByUserId(userId);
    }

    private static boolean isActiveNow(ProductEnrollment e) {
        if (e.getStatus() != EnrollmentStatus.ACTIVE) return false;
        return e.getValidUntil() == null || e.getValidUntil().isAfter(Instant.now());
    }

    static EnrollmentDto toDto(ProductEnrollment e) {
        return new EnrollmentDto(
                e.getProduct(),
                e.getStatus().name().toLowerCase(Locale.ROOT),
                e.getSource().name().toLowerCase(Locale.ROOT),
                e.getActivatedAt(),
                e.getValidUntil());
    }

    // ── 写：非兑换类开通 ────────────────────────────────────────────────────────

    /** 幂等 upsert 一条开通记录（已 ACTIVE 的行只刷新来源与有效期，不重置 activatedAt）。 */
    @Transactional
    public ProductEnrollment upsert(String userId, String product, EnrollmentStatus status,
                                    EnrollmentSource source, Instant validUntil) {
        String normalized = requireKnownProduct(product);
        Instant now = Instant.now();
        ProductEnrollment row = enrollmentRepo.findByUserIdAndProduct(userId, normalized)
                .orElseGet(() -> ProductEnrollment.builder()
                        .id(UUID.randomUUID().toString())
                        .userId(userId)
                        .product(normalized)
                        .createdAt(now)
                        .build());
        row.setStatus(status);
        row.setSource(source);
        row.setValidUntil(validUntil);
        if (status == EnrollmentStatus.ACTIVE && row.getActivatedAt() == null) {
            row.setActivatedAt(now);
        }
        row.setUpdatedAt(now);
        return enrollmentRepo.save(row);
    }

    /** 给账号开通全部五个子产品（dev grant-all / 运营兜底）。 */
    @Transactional
    public void grantAll(String userId, EnrollmentSource source) {
        for (String product : PlatformSupport.ALL) {
            upsert(userId, product, EnrollmentStatus.ACTIVE, source, null);
        }
    }

    /**
     * 新账号（无激活码，如统一账号中心 JIT 建档）的开通策略，对齐 §12.2：
     * dev（{@code aep.platform.dev-grant-all=true}）→ 五个产品 ACTIVE/GRANT_ALL；
     * 生产 → <b>一条都不建</b>，用户进产品看到开通页。
     */
    @Transactional
    public void grantForNewUser(String userId, String registeringPlatform) {
        if (!platformAccessService.isDevGrantAll()) {
            log.debug("[enrollment] production mode: no enrollment created for new user {} (platform={})",
                    userId, registeringPlatform);
            return;
        }
        grantAll(userId, EnrollmentSource.GRANT_ALL);
    }

    // ── 写：激活码兑换（唯一路径） ──────────────────────────────────────────────

    /** 已通过全部可激活性校验的 key + batch 对。 */
    public record ActivatableKey(LicenseKey key, LicenseBatch batch) {}

    /**
     * 一次兑换的结果。
     *
     * @param products         本次开通 / 续期的子产品集合
     * @param creditsGranted   本次发放积分
     * @param newTotalBalance  发放后的总余额
     */
    public record RedeemOutcome(List<String> products, long creditsGranted, long newTotalBalance,
                                LicenseKey key, LicenseBatch batch) {}

    /**
     * 校验激活码可用性（**不占用**）。保持 legacy HTTP 语义：
     * 404 无效 / 409 已用 / 410 过期 —— {@code /api/auth/activate} 与
     * {@code /api/me/license/activate} 的既有客户端依赖这些状态码。
     */
    @Transactional(readOnly = true)
    public ActivatableKey validateKey(String rawCode, String logCtx) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "激活码不能为空");
        }
        String codeHash = sha256(rawCode.trim().toUpperCase(Locale.ROOT));
        Optional<LicenseKey> keyOpt = keyRepo.findByCodeHash(codeHash);
        if (keyOpt.isEmpty()) {
            log.warn("[license] activation rejected invalid-code hashPrefix={} {}",
                    codeHash.substring(0, 8), logCtx);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "无效的激活码");
        }
        LicenseKey key = keyOpt.get();
        if (key.getStatus() != LicenseKey.LicenseKeyStatus.CREATED) {
            log.warn("[license] activation rejected keyId={} status={} {}", key.getId(), key.getStatus(), logCtx);
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "该激活码已被使用或已失效（当前状态: " + key.getStatus() + "）");
        }
        LicenseBatch batch = batchRepo.findById(key.getBatchId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "批次数据异常"));

        Instant now = Instant.now();
        if (batch.getStatus() == LicenseBatch.LicenseBatchStatus.REVOKED
                || batch.getStatus() == LicenseBatch.LicenseBatchStatus.EXPIRED) {
            log.warn("[license] activation rejected batch inactive keyId={} batchId={} status={}",
                    key.getId(), batch.getId(), batch.getStatus());
            throw new ResponseStatusException(HttpStatus.GONE, "该激活码所属批次已失效");
        }
        if (batch.getValidTo() != null && batch.getValidTo().isBefore(now)) {
            log.warn("[license] activation rejected batch expired keyId={} batchId={} validTo={}",
                    key.getId(), batch.getId(), batch.getValidTo());
            throw new ResponseStatusException(HttpStatus.GONE, "该激活码所属批次已过期");
        }
        if (key.getExpiresAt() != null && key.getExpiresAt().isBefore(now)) {
            log.warn("[license] activation rejected key expired keyId={} batchId={} expiresAt={}",
                    key.getId(), batch.getId(), key.getExpiresAt());
            throw new ResponseStatusException(HttpStatus.GONE, "该激活码已过期");
        }
        // v0.36：issuerTenantId 现可为 null（新批次走纯 SellingChannel 路径）。
        if (batch.getIssuerTenantId() != null && !batch.getIssuerTenantId().isBlank()
                && !tenantRepo.existsById(batch.getIssuerTenantId())) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "批次发放方租户不存在");
        }
        return new ActivatableKey(key, batch);
    }

    /**
     * 本次激活码将开通哪些子产品：批次显式声明 {@code platforms} 时按批次授权
     * （「指定子应用」秘钥）；未声明（全站秘钥）时沿用既有注册来源策略
     * （{@code PlatformAccessService.grantedCsvForNewUser}）。
     */
    public List<String> resolveGrantedProducts(LicenseBatch batch, String registeringPlatform) {
        List<String> declared = PlatformSupport.parse(batch.getPlatforms());
        if (!declared.isEmpty()) return declared;
        return PlatformSupport.parse(platformAccessService.grantedCsvForNewUser(registeringPlatform));
    }

    /**
     * 兑换一把已校验过的激活码：占用 key → 写 entitlement_grant → 补 Studio/Wallet →
     * 发积分 → upsert enrollment → 同步旧 platforms CSV → 发开通事件。
     *
     * @param requestedProduct 调用方要求开通的子产品；非 null 时必须在批次授权范围内，
     *                         否则 400 {@code LICENSE_KEY_PRODUCT_MISMATCH}（先判后占，不烧码）
     */
    @Transactional
    public RedeemOutcome redeem(String userId, ActivatableKey validated, String registeringPlatform,
                                String requestedProduct, String creditDescription) {
        LicenseKey key = validated.key();
        LicenseBatch batch = validated.batch();
        Instant now = Instant.now();

        List<String> products = resolveGrantedProducts(batch, registeringPlatform);
        if (products.isEmpty()) products = List.of(PlatformSupport.ALL.get(0));

        String primary = requestedProduct == null ? products.get(0) : requireKnownProduct(requestedProduct);
        if (requestedProduct != null && !products.contains(primary)) {
            // 先判后占：不匹配的码原样留在 CREATED，用户可以拿去开正确的子产品。
            throw new BusinessException(HttpStatus.BAD_REQUEST, "LICENSE_KEY_PRODUCT_MISMATCH",
                    "该激活码不能用于开通此子产品",
                    Map.of("product", primary, "allowed", products));
        }

        // ── 闸① 条件更新占用激活码 ───────────────────────────────────────────────
        int claimed = keyRepo.claimForActivation(key.getId(), userId, now,
                LicenseKey.LicenseKeyStatus.CREATED, LicenseKey.LicenseKeyStatus.ACTIVATED);
        if (claimed != 1) {
            log.warn("[license] claim lost keyId={} userId={} (concurrent redeem)", key.getId(), userId);
            throw new BusinessException(HttpStatus.CONFLICT, "LICENSE_KEY_UNAVAILABLE",
                    "该激活码已被使用或已失效");
        }
        key.setStatus(LicenseKey.LicenseKeyStatus.ACTIVATED);
        key.setActivatedByUserId(userId);
        key.setActivatedAt(now);

        // ── 闸② 权益凭据唯一约束 ────────────────────────────────────────────────
        // v0.150：本次开通的**每个**子产品各写一行（UNIQUE 是 (source, source_reference, product)）。
        // 一把全站秘钥同时开五个产品时，此前只记「主产品」一行，日后按产品退权 / 对账无凭据可依。
        try {
            for (String product : products) {
                grantRepo.saveAndFlush(EntitlementGrant.builder()
                        .id(UUID.randomUUID().toString())
                        .userId(userId)
                        .product(product)
                        .source(EnrollmentSource.LICENSE)
                        .sourceReference(key.getId())
                        .grantedAt(now)
                        .validUntil(null)
                        .status(EntitlementGrant.GrantStatus.ACTIVE)
                        .build());
            }
        } catch (DataIntegrityViolationException e) {
            log.warn("[license] duplicate entitlement grant keyId={} userId={}", key.getId(), userId);
            throw new BusinessException(HttpStatus.CONFLICT, "LICENSE_KEY_UNAVAILABLE",
                    "该激活码已被使用或已失效");
        }

        // 批次核销计数
        batch.setActivatedCount(batch.getActivatedCount() + 1);
        if (batch.getActivatedCount() >= batch.getTotalCount()) {
            batch.setStatus(LicenseBatch.LicenseBatchStatus.EXHAUSTED);
        }
        batchRepo.save(batch);

        // ── Studio / Wallet 幂等补建 + 发积分 ─────────────────────────────────────
        ensureStudio(userId);
        long grant = batch.getInitialCreditGrant();
        long newTotalBalance;
        if (grant > 0) {
            newTotalBalance = creditService.creditAccount(userId, grant,
                    LedgerEntry.LedgerEntryType.LICENSE_GRANT, "license_key", key.getId(),
                    creditDescription).balanceAfter();
        } else {
            newTotalBalance = walletRepo.findByUserId(userId).map(Wallet::getTotalBalance).orElse(0L);
        }

        // ── 开通 + 旧 CSV 兼容双写 ───────────────────────────────────────────────
        for (String product : products) {
            upsert(userId, product, EnrollmentStatus.ACTIVE, EnrollmentSource.LICENSE, null);
        }
        syncLegacyPlatformCsv(userId, batch, products);
        for (String product : products) {
            events.publishEvent(new EnrollmentActivatedEvent(userId, product));
        }

        log.info("[license] redeem success userId={} keyId={} batchId={} grant={} products={}",
                userId, key.getId(), batch.getId(), grant, products);
        return new RedeemOutcome(products, grant, newTotalBalance, key, batch);
    }

    /** 按原始激活码兑换（校验 + 兑换一步到位）。 */
    @Transactional
    public RedeemOutcome redeemByCode(String userId, String rawCode, String registeringPlatform,
                                      String requestedProduct, String creditDescription) {
        ActivatableKey validated = validateKey(rawCode, "userId=" + userId);
        return redeem(userId, validated, registeringPlatform, requestedProduct, creditDescription);
    }

    /**
     * {@code POST /api/me/enrollments/{product}/activate} 的服务实现。
     *
     * <p>§12.2 要求这条新契约把「不存在 / 已激活 / 并发抢输」统一收敛成 409
     * {@code LICENSE_KEY_UNAVAILABLE}（不向前端泄露激活码状态细节）；
     * legacy 两个端点仍保留 404/409/410 的原有语义。</p>
     */
    @Transactional
    public EnrollmentDto activateWithLicense(String userId, String product, String licenseKey) {
        String normalized = requireKnownProduct(product);
        try {
            redeemByCode(userId, licenseKey, normalized, normalized, "激活码开通子产品");
        } catch (ResponseStatusException e) {
            int status = e.getStatusCode().value();
            if (status == HttpStatus.NOT_FOUND.value() || status == HttpStatus.CONFLICT.value()
                    || status == HttpStatus.GONE.value()) {
                throw new BusinessException(HttpStatus.CONFLICT, "LICENSE_KEY_UNAVAILABLE",
                        e.getReason() == null ? "该激活码已被使用或已失效" : e.getReason());
            }
            if (status == HttpStatus.BAD_REQUEST.value()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "LICENSE_KEY_INVALID",
                        e.getReason() == null ? "激活码不可用" : e.getReason());
            }
            throw e;
        }
        return enrollmentRepo.findByUserIdAndProduct(userId, normalized)
                .map(EnrollmentService::toDto)
                .orElseThrow(() -> new BusinessException(HttpStatus.INTERNAL_SERVER_ERROR,
                        "ENROLLMENT_WRITE_FAILED", "开通记录写入异常，请重试"));
    }

    // ── 内部工具 ──────────────────────────────────────────────────────────────

    /**
     * 旧 {@code aep_users.platforms} CSV 兼容双写：全站秘钥清空显式配置（= 全平台），
     * 指定子应用秘钥做并集。语义与 v0.53 的追加激活完全一致，
     * 只是现在权益真值已经在 {@code product_enrollment}，CSV 仅供未升级的读取方兜底。
     */
    private void syncLegacyPlatformCsv(String userId, LicenseBatch batch, List<String> products) {
        AepUser user = userRepo.findById(userId).orElse(null);
        if (user == null) return;
        List<String> declared = PlatformSupport.parse(batch.getPlatforms());
        List<String> current = PlatformSupport.parse(user.getPlatforms());
        if (declared.isEmpty() && products.size() == PlatformSupport.ALL.size()) {
            // 全站秘钥（未声明子应用）且策略授予全集 → 写全集 CSV（等价于 legacy 的「清空 = 全平台」，但更显式）
            user.setPlatforms(PlatformSupport.toCsv(PlatformSupport.ALL));
        } else if (!current.isEmpty()) {
            LinkedHashSet<String> merged = new LinkedHashSet<>(current);
            merged.addAll(products);
            user.setPlatforms(PlatformSupport.toCsv(merged));
        } else if (user.getPlatforms() != null && !user.getPlatforms().isBlank()) {
            // 显式配置解析后为空（脏数据）→ 按本次授予重写
            user.setPlatforms(PlatformSupport.toCsv(products));
        }
        // current 为空且 CSV 本身空白 = 老账号「全平台」语义，保持不动
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
    }

    /**
     * 一个账号对应一个 Studio。历史注册路径漏建过 Studio 行（2026-08 审计），
     * 开通时按约定惰性补建，避免后续业务 409 死锁。
     */
    private void ensureStudio(String userId) {
        if (studioRepo.findByOwnerUserId(userId).isPresent()) return;
        AepUser user = userRepo.findById(userId).orElse(null);
        if (user == null) return;
        String name = user.getDisplayName() != null && !user.getDisplayName().isBlank()
                ? user.getDisplayName() + "的工作室"
                : user.getUsername() + "的工作室";
        Instant now = Instant.now();
        studioRepo.save(Studio.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(userId)
                .name(name)
                .kind(Studio.StudioKind.PERSONAL_CREATOR)
                .status(Studio.StudioStatus.ACTIVE)
                .contactEmail(user.getEmail())
                .contactPhone(user.getPhone())
                .createdAt(now)
                .updatedAt(now)
                .build());
    }

    private static String requireKnownProduct(String product) {
        String p = product == null ? "" : product.trim().toLowerCase(Locale.ROOT);
        if (!PlatformSupport.ALL.contains(p)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PRODUCT_INVALID",
                    "未知的子产品：" + product);
        }
        return p;
    }

    private static String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(input.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }

    /** 回填 runner 用：批量筛出「一条 enrollment 都没有」的账号。 */
    @Transactional(readOnly = true)
    public List<String> filterUsersWithoutEnrollment(List<String> userIds) {
        if (userIds.isEmpty()) return List.of();
        List<String> have = enrollmentRepo.findUserIdsIn(userIds);
        List<String> missing = new ArrayList<>();
        for (String id : userIds) {
            if (!have.contains(id)) missing.add(id);
        }
        return missing;
    }
}
