package com.aistareco.aep.service;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.StudioDto;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Account registration via license key activation.
 *
 * Flow (see /product_spec.md §2.2 — 一个账号 = 一个 Studio):
 *   1. SHA-256 hash raw code → find LicenseKey
 *   2. Validate key + batch (status, expiry windows)
 *   3. Create AepUser (kind 固定为 STUDIO)
 *   4. Create Studio (name 来自激活请求；一个账号必有一个 Studio)
 *   5. Create Membership { tenantId = batch.issuerTenantId, source = LICENSE_ACTIVATION }
 *   6. Create Wallet for user
 *   7. Write LedgerEntry (LICENSE_GRANT, batch.initialCreditGrant) and update wallet balances
 *   8. Mark LicenseKey ACTIVATED, increment batch.activatedCount
 *   9. Issue JWT
 */
@Service
public class LicenseActivationService {

    private static final Logger log = LoggerFactory.getLogger(LicenseActivationService.class);

    private final LicenseKeyRepository keyRepo;
    private final LicenseBatchRepository batchRepo;
    private final AepUserRepository userRepo;
    private final TenantRepository tenantRepo;
    private final MembershipRepository membershipRepo;
    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final StudioRepository studioRepo;
    private final JwtUtil jwtUtil;
    private final PlatformAccessService platformAccessService;

    public LicenseActivationService(LicenseKeyRepository keyRepo,
                                     LicenseBatchRepository batchRepo,
                                     AepUserRepository userRepo,
                                     TenantRepository tenantRepo,
                                     MembershipRepository membershipRepo,
                                     WalletRepository walletRepo,
                                     LedgerEntryRepository ledgerRepo,
                                     StudioRepository studioRepo,
                                     JwtUtil jwtUtil,
                                     PlatformAccessService platformAccessService) {
        this.keyRepo = keyRepo;
        this.batchRepo = batchRepo;
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
        this.membershipRepo = membershipRepo;
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
        this.studioRepo = studioRepo;
        this.jwtUtil = jwtUtil;
        this.platformAccessService = platformAccessService;
    }

    /** 已通过全部可激活性校验的 key + batch 对。 */
    record ActivatableKey(LicenseKey key, LicenseBatch batch) {}

    /**
     * v0.53：抽出 key + batch 的可激活性校验（注册激活 / 已登录追加激活共用）。
     * logCtx 仅用于日志定位（如 "username=xx phone=yy" / "userId=zz"）。
     */
    private ActivatableKey requireActivatableKey(String rawCode, String logCtx) {
        if (rawCode == null || rawCode.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "激活码不能为空");
        }

        String codeHash = sha256(rawCode.trim().toUpperCase());
        Optional<LicenseKey> keyOpt = keyRepo.findByCodeHash(codeHash);
        if (keyOpt.isEmpty()) {
            log.warn("[license] activation rejected invalid-code hashPrefix={} {}",
                    codeHash.substring(0, 8), logCtx);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "无效的激活码");
        }
        LicenseKey key = keyOpt.get();

        if (key.getStatus() != LicenseKey.LicenseKeyStatus.CREATED) {
            log.warn("[license] activation rejected keyId={} status={} {}",
                    key.getId(), key.getStatus(), logCtx);
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
        // 仅老批次时才校验 tenant 存在性，否则 existsById(null) 会抛 InvalidDataAccessApiUsageException。
        if (batch.getIssuerTenantId() != null && !batch.getIssuerTenantId().isBlank()
                && !tenantRepo.existsById(batch.getIssuerTenantId())) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "批次发放方租户不存在");
        }
        return new ActivatableKey(key, batch);
    }

    /**
     * v0.53：计算激活授予的平台 CSV —— 批次显式声明 platforms 时按批次授权
     * （秘钥分「全站可用 / 指定子应用」，优先级高于 dev-grant-all）；
     * 批次未声明（全站秘钥）时沿用既有注册来源策略。
     */
    private String resolveGrantedPlatforms(LicenseBatch batch, String registeringPlatform) {
        java.util.List<String> batchPlatforms = PlatformSupport.parse(batch.getPlatforms());
        if (!batchPlatforms.isEmpty()) {
            return PlatformSupport.toCsv(batchPlatforms);
        }
        return platformAccessService.grantedCsvForNewUser(registeringPlatform);
    }

    @Transactional
    public Map<String, Object> activate(Map<String, String> body) {
        ActivatableKey validated = requireActivatableKey(body.get("code"),
                "username=" + body.get("username") + " phone=" + body.get("phone"));
        LicenseKey key = validated.key();
        LicenseBatch batch = validated.batch();
        Instant now = Instant.now();

        String username = body.getOrDefault("username", "user_" + System.currentTimeMillis());
        String email = body.get("email");
        String phone = body.get("phone");
        validateUserIdentity(username, email, phone);

        String studioName = body.get("studioName");
        if (studioName == null || studioName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "工作室名称不能为空");
        }
        Studio.StudioKind studioKind = parseStudioKind(body.get("studioKind"));

        // v0.43+: 子产品平台授权。注册来源平台由 body.platform 透传（music/drama/celebrity/aiavatar）。
        // v0.53+: 批次声明了 platforms 的秘钥按批次授权（如「仅 aiavatar」），优先于 dev-grant-all；
        // 全站秘钥（批次未声明）沿用注册来源策略（开发态 dev-grant-all=true 授予全部平台）。
        String grantedPlatforms = resolveGrantedPlatforms(batch, body.get("platform"));

        AepUser user = AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username(username)
                .email(email)
                .phone(phone)
                .displayName(body.get("displayName"))
                .kind(AepUser.AccountKind.STUDIO)
                .status(AepUser.UserStatus.ACTIVE)
                .platforms(grantedPlatforms)
                .emailVerified(false)
                .phoneVerified(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
        userRepo.save(user);

        Studio studio = studioRepo.save(Studio.builder()
                .id(UUID.randomUUID().toString())
                .ownerUserId(user.getId())
                .name(studioName.trim())
                .kind(studioKind)
                .status(Studio.StudioStatus.ACTIVE)
                .contactEmail(email)
                .contactPhone(phone)
                .createdAt(now)
                .updatedAt(now)
                .build());

        // v0.36：只在老批次（issuerTenantId 非空）时建 Membership。
        // 新批次走 SellingChannel 路径，与 Tenant 体系解耦，不再自动加 Membership。
        if (batch.getIssuerTenantId() != null && !batch.getIssuerTenantId().isBlank()) {
            membershipRepo.save(Membership.builder()
                    .id(UUID.randomUUID().toString())
                    .tenantId(batch.getIssuerTenantId())
                    .userId(user.getId())
                    .source(Membership.MembershipSource.LICENSE_ACTIVATION)
                    .licenseKeyId(key.getId())
                    .joinedAt(now)
                    .build());
        }

        long grant = batch.getInitialCreditGrant();
        Wallet wallet = Wallet.builder()
                .id(UUID.randomUUID().toString())
                .userId(user.getId())
                .totalBalance(grant)
                .licenseBalance(grant)
                .rechargeBalance(0L)
                .giftBalance(0L)
                .pendingBalance(0L)
                .createdAt(now)
                .updatedAt(now)
                .build();
        walletRepo.save(wallet);

        if (grant > 0) {
            ledgerRepo.save(LedgerEntry.builder()
                    .id(UUID.randomUUID().toString())
                    .walletId(wallet.getId())
                    .userId(user.getId())
                    .entryType(LedgerEntry.LedgerEntryType.LICENSE_GRANT)
                    .amount(grant)
                    .balanceAfter(wallet.getTotalBalance())
                    .description("激活码发放初始积分")
                    .referenceId(key.getId())
                    .referenceType("license_key")
                    .createdAt(now)
                    .build());
        }

        key.setStatus(LicenseKey.LicenseKeyStatus.ACTIVATED);
        key.setActivatedByUserId(user.getId());
        key.setActivatedAt(now);
        keyRepo.save(key);

        batch.setActivatedCount(batch.getActivatedCount() + 1);
        if (batch.getActivatedCount() >= batch.getTotalCount()) {
            batch.setStatus(LicenseBatch.LicenseBatchStatus.EXHAUSTED);
        }
        batchRepo.save(batch);

        // v0.31+: operatorRole 优先；新激活用户默认无 operatorRole，落到 kind。
        String role = user.getOperatorRole() != null
                ? user.getOperatorRole().name()
                : user.getKind().name();
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), role);

        // v0.36：Map.of 禁止 null 值；issuerTenantId 可能为 null（SellingChannel-only 批次）。
        // 用 HashMap，缺省为 null 时省略 tenantId 字段（前端 LicenseRedeemResult.tenantId 已为 optional）。
        java.util.HashMap<String, Object> resp = new java.util.HashMap<>();
        resp.put("token", token);
        resp.put("user", AepUserDto.from(user));
        resp.put("studio", StudioDto.from(studio));
        if (batch.getIssuerTenantId() != null) {
            resp.put("tenantId", batch.getIssuerTenantId());
        }
        if (batch.getSellingChannelId() != null) {
            resp.put("sellingChannelId", batch.getSellingChannelId());
        }
        log.info("[license] activation success userId={} studioId={} keyId={} batchId={} grant={} platforms={} channel={}",
                user.getId(), studio.getId(), key.getId(), batch.getId(), grant, grantedPlatforms, batch.getSellingChannelId());
        return resp;
    }

    /**
     * v0.53：已登录账号「追加激活」秘钥 —— 不建新账号，而是：
     * <ol>
     *   <li>校验 key + batch（与注册激活同一套规则）</li>
     *   <li>合并授予批次平台到 user.platforms（全站秘钥 → 升为全部平台；
     *       指定子应用秘钥 → 在现有平台集上做并集；用户原本已是全平台则保持）</li>
     *   <li>按批次 initialCreditGrant 追加发放积分（wallet.licenseBalance + 不可变账本
     *       LICENSE_GRANT，遵守 §4.2 禁止裸 UPDATE balance 的约束 —— 余额变动伴随 LedgerEntry）</li>
     *   <li>key 标记 ACTIVATED（activatedByUserId = 当前用户）+ 批次核销计数</li>
     * </ol>
     * 老批次（issuerTenantId 非空）补建 Membership（幂等：已是成员则跳过）。
     */
    @Transactional
    public Map<String, Object> activateForExistingUser(String userId, String rawCode) {
        AepUser user = userRepo.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "用户不存在"));

        ActivatableKey validated = requireActivatableKey(rawCode, "userId=" + userId + " (append)");
        LicenseKey key = validated.key();
        LicenseBatch batch = validated.batch();
        Instant now = Instant.now();

        // ── 平台合并 ────────────────────────────────────────────────────────────
        java.util.List<String> batchPlatforms = PlatformSupport.parse(batch.getPlatforms());
        String beforeCsv = user.getPlatforms();
        boolean userHasAll = PlatformSupport.parse(beforeCsv).isEmpty(); // 空配置 = 全平台
        if (batchPlatforms.isEmpty()) {
            // 全站秘钥 → 升为全部平台（清空显式配置 = effective ALL）
            user.setPlatforms(null);
        } else if (!userHasAll) {
            java.util.LinkedHashSet<String> merged = new java.util.LinkedHashSet<>(PlatformSupport.parse(beforeCsv));
            merged.addAll(batchPlatforms);
            user.setPlatforms(PlatformSupport.toCsv(merged));
        } // userHasAll && batch 指定子应用 → 已含该平台，保持 null
        user.setUpdatedAt(now);
        userRepo.save(user);

        // ── 积分追加发放（钱包缺失则补建，防御老种子数据） ───────────────────────
        long grant = batch.getInitialCreditGrant();
        Wallet wallet = walletRepo.findByUserId(userId).orElseGet(() -> Wallet.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .totalBalance(0L).licenseBalance(0L)
                .rechargeBalance(0L).giftBalance(0L).pendingBalance(0L)
                .createdAt(now).updatedAt(now)
                .build());
        if (grant > 0) {
            wallet.setLicenseBalance(wallet.getLicenseBalance() + grant);
            wallet.setTotalBalance(wallet.getTotalBalance() + grant);
            wallet.setUpdatedAt(now);
        }
        walletRepo.save(wallet);
        if (grant > 0) {
            ledgerRepo.save(LedgerEntry.builder()
                    .id(UUID.randomUUID().toString())
                    .walletId(wallet.getId())
                    .userId(userId)
                    .entryType(LedgerEntry.LedgerEntryType.LICENSE_GRANT)
                    .amount(grant)
                    .balanceAfter(wallet.getTotalBalance())
                    .description("追加激活秘钥发放积分")
                    .referenceId(key.getId())
                    .referenceType("license_key")
                    .createdAt(now)
                    .build());
        }

        // ── 老批次补建 Membership（幂等） ────────────────────────────────────────
        if (batch.getIssuerTenantId() != null && !batch.getIssuerTenantId().isBlank()) {
            boolean alreadyMember = membershipRepo.findByUserId(userId).stream()
                    .anyMatch(m -> batch.getIssuerTenantId().equals(m.getTenantId()));
            if (!alreadyMember) {
                membershipRepo.save(Membership.builder()
                        .id(UUID.randomUUID().toString())
                        .tenantId(batch.getIssuerTenantId())
                        .userId(userId)
                        .source(Membership.MembershipSource.LICENSE_ACTIVATION)
                        .licenseKeyId(key.getId())
                        .joinedAt(now)
                        .build());
            }
        }

        // ── 核销 ────────────────────────────────────────────────────────────────
        key.setStatus(LicenseKey.LicenseKeyStatus.ACTIVATED);
        key.setActivatedByUserId(userId);
        key.setActivatedAt(now);
        keyRepo.save(key);

        batch.setActivatedCount(batch.getActivatedCount() + 1);
        if (batch.getActivatedCount() >= batch.getTotalCount()) {
            batch.setStatus(LicenseBatch.LicenseBatchStatus.EXHAUSTED);
        }
        batchRepo.save(batch);

        java.util.HashMap<String, Object> resp = new java.util.HashMap<>();
        resp.put("user", AepUserDto.from(user));
        resp.put("creditsGranted", grant);
        resp.put("newTotalBalance", wallet.getTotalBalance());
        resp.put("platformsGranted", batchPlatforms.isEmpty() ? PlatformSupport.ALL : batchPlatforms);
        log.info("[license] append-activation success userId={} keyId={} batchId={} grant={} platforms: '{}' → '{}'",
                userId, key.getId(), batch.getId(), grant, beforeCsv, user.getPlatforms());
        return resp;
    }

    private void validateUserIdentity(String username, String email, String phone) {
        if (userRepo.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在，请更换后重试");
        }
        if (email != null && !email.isBlank() && userRepo.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该邮箱已绑定其他账号");
        }
        if (phone != null && !phone.isBlank() && userRepo.existsByPhone(phone)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "该手机号已绑定其他账号");
        }
    }

    private Studio.StudioKind parseStudioKind(String raw) {
        if (raw == null || raw.isBlank()) return Studio.StudioKind.PERSONAL_CREATOR;
        try {
            return Studio.StudioKind.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return Studio.StudioKind.PERSONAL_CREATOR;
        }
    }

    private String sha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException("SHA-256 not available", e);
        }
    }
}
