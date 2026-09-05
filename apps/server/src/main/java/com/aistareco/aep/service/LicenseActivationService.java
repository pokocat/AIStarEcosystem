package com.aistareco.aep.service;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.enrollment.service.EnrollmentService;
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

    private final AepUserRepository userRepo;
    private final MembershipRepository membershipRepo;
    private final StudioRepository studioRepo;
    private final JwtUtil jwtUtil;
    private final NotificationPublisher notificationPublisher;
    private final EnrollmentService enrollmentService;

    public LicenseActivationService(AepUserRepository userRepo,
                                     MembershipRepository membershipRepo,
                                     StudioRepository studioRepo,
                                     JwtUtil jwtUtil,
                                     NotificationPublisher notificationPublisher,
                                     EnrollmentService enrollmentService) {
        this.userRepo = userRepo;
        this.membershipRepo = membershipRepo;
        this.studioRepo = studioRepo;
        this.jwtUtil = jwtUtil;
        this.notificationPublisher = notificationPublisher;
        this.enrollmentService = enrollmentService;
    }

    /**
     * v0.149：激活码兑换的唯一实现已下沉 {@link EnrollmentService}
     * （条件更新占码 + entitlement_grant 唯一约束 + 发积分 + 开通 product_enrollment）。
     * 本类只保留两条 legacy 入口各自特有的部分：注册路径的建号 / 建 Studio / 建 Membership /
     * 签 JWT，以及追加激活路径的响应形状。
     */
    @Transactional
    public Map<String, Object> activate(Map<String, String> body) {
        // 先校验（不占码）：激活码无效时不能留下半个账号。
        EnrollmentService.ActivatableKey validated = enrollmentService.validateKey(body.get("code"),
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
        String registeringPlatform = body.get("platform");
        String grantedPlatforms = PlatformSupport.toCsv(
                enrollmentService.resolveGrantedProducts(batch, registeringPlatform));

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

        // v0.149：占码 / 权益凭据 / 发积分 / 开通 product_enrollment 统一走 EnrollmentService，
        // 与「已登录追加激活」「/api/me/enrollments/{product}/activate」共用同一条兑换路径。
        EnrollmentService.RedeemOutcome outcome = enrollmentService.redeem(
                user.getId(), validated, registeringPlatform, null, "激活码发放初始积分");
        long grant = outcome.creditsGranted();

        // v0.58：注册激活是运营关注的核心事件，写进 admin 收件箱（旁路，失败不阻塞注册）
        notificationPublisher.notifyAdmins(Notification.NotificationType.FAN,
                "新用户激活",
                "用户 " + (user.getDisplayName() != null && !user.getDisplayName().isBlank()
                        ? user.getDisplayName() : user.getUsername())
                        + "（登录名 " + user.getUsername() + "）通过激活码完成注册，工作室「"
                        + studio.getName() + "」，初始积分 " + grant + "（批次 " + batch.getName() + "）。",
                user.getId());

        // §12.1（v0.149+）：消费者令牌只带账号类型（role = kind），operatorRole 不再进令牌。
        String token = jwtUtil.consumerToken(user);

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

        EnrollmentService.ActivatableKey validated =
                enrollmentService.validateKey(rawCode, "userId=" + userId + " (append)");
        LicenseKey key = validated.key();
        LicenseBatch batch = validated.batch();
        Instant now = Instant.now();
        String beforeCsv = user.getPlatforms();

        // v0.149：占码 / 权益凭据 / 发积分 / 开通 product_enrollment / 旧 platforms CSV 同步
        // 全部在 EnrollmentService.redeem 里完成 —— 与注册激活、新开通端点共用同一条兑换路径。
        EnrollmentService.RedeemOutcome outcome = enrollmentService.redeem(
                userId, validated, null, null, "追加激活秘钥发放积分");

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

        AepUser refreshed = userRepo.findById(userId).orElse(user);
        java.util.HashMap<String, Object> resp = new java.util.HashMap<>();
        resp.put("user", AepUserDto.from(refreshed));
        resp.put("creditsGranted", outcome.creditsGranted());
        resp.put("newTotalBalance", outcome.newTotalBalance());
        resp.put("platformsGranted", outcome.products());
        log.info("[license] append-activation success userId={} keyId={} batchId={} grant={} platforms: '{}' -> '{}'",
                userId, key.getId(), batch.getId(), outcome.creditsGranted(), beforeCsv, refreshed.getPlatforms());
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
