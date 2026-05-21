package com.aistareco.aep.service;

import com.aistareco.aep.dto.SocialAccountBindInitDto;
import com.aistareco.aep.dto.SocialAccountBindPollResultDto;
import com.aistareco.aep.dto.SocialAccountDto;
import com.aistareco.aep.model.SocialAccount;
import com.aistareco.aep.model.SocialAccountStatus;
import com.aistareco.aep.model.SocialPlatform;
import com.aistareco.aep.repository.SocialAccountRepository;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 社交账号绑定流程编排。
 *
 * 流程 (扫码登录)：
 *   1. initBind: 前端选平台 + 别名 → server 创 PENDING 行，调 sau-service /login/start 拿 QR
 *   2. pollBind: 前端轮询 → server 调 sau-service /login/poll
 *      若 success → 取明文 storage_state → 加密 → 落库 → 翻 ACTIVE → 返回清洁 DTO
 *   3. verify: 用现有密文跑一次 sau-service /accounts/verify
 *   4. unbind: 删 DB 行 (密文一并消失)
 *
 * 明文 storage_state 仅在本类方法的**局部变量**中存在；不写盘、不日志、不出口。
 */
@Service
public class SocialAccountService {

    private final SocialAccountRepository repo;
    private final SocialAccountSecretService secret;
    private final SauServiceClient sau;

    public SocialAccountService(SocialAccountRepository repo,
                                  SocialAccountSecretService secret,
                                  SauServiceClient sau) {
        this.repo = repo;
        this.secret = secret;
        this.sau = sau;
    }

    public List<SocialAccountDto> listByUser(String userId) {
        return repo.findByUserIdOrderByBoundAtDesc(userId).stream()
                .map(SocialAccountDto::from)
                .toList();
    }

    /** Admin 视图：列出全部用户的社交账号（不带 userId 过滤）。供 AdminSocialAccountController 使用。 */
    public List<SocialAccountDto> listAll() {
        return repo.findAll().stream()
                .sorted((a, b) -> {
                    Instant ba = a.getBoundAt(), bb = b.getBoundAt();
                    if (ba == null && bb == null) return 0;
                    if (ba == null) return 1;
                    if (bb == null) return -1;
                    return bb.compareTo(ba);
                })
                .map(SocialAccountDto::from)
                .toList();
    }

    /**
     * 启动扫码绑定。
     *
     * 同 (userId, platform, accountName) 已存在的：
     *   - status=ACTIVE → 拒绝 (需先 unbind)
     *   - status=PENDING/EXPIRED/BANNED → 复用此行 (更新为 PENDING 重新绑定)
     */
    @Transactional
    public SocialAccountBindInitDto initBind(String userId, String platformWire, String accountName) {
        if (userId == null || userId.isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "未登录");
        }
        if (accountName == null || accountName.isBlank()) {
            throw BusinessException.badRequest("ACCOUNT_NAME_REQUIRED", "缺少账号别名 accountName");
        }
        SocialPlatform platform = SocialPlatform.fromWire(platformWire);
        if (platform == null) {
            throw BusinessException.badRequest("PLATFORM_INVALID", "未知平台 platform=" + platformWire);
        }
        if (!platform.enabledInV1()) {
            throw new BusinessException(HttpStatus.NOT_IMPLEMENTED, "PLATFORM_NOT_IMPLEMENTED",
                    "v1 暂未实现该平台的 Playwright 自动化 (platform=" + platform.wire() + ")");
        }

        Optional<SocialAccount> existing = repo.findByUserIdAndPlatformAndAccountName(userId, platform, accountName);
        SocialAccount entity = existing.orElse(null);
        if (entity != null && entity.getStatus() == SocialAccountStatus.ACTIVE) {
            throw new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_ALREADY_ACTIVE",
                    "该账号别名已被一个有效账号占用，请先解绑或换一个别名");
        }
        if (entity == null) {
            entity = SocialAccount.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(userId)
                    .platform(platform)
                    .accountName(accountName)
                    .status(SocialAccountStatus.PENDING)
                    .build();
        } else {
            entity.setStatus(SocialAccountStatus.PENDING);
            entity.setStorageStateEncrypted(null);
            entity.setDisplayName(null);
            entity.setPlatformAccountId(null);
            entity.setAvatarUrl(null);
        }
        repo.save(entity);

        // 用 entity.id 当 sau-service 的 ticket — 这样 pollBind 时找回 entity 行不用维护额外映射
        String ticket = entity.getId();
        Map<String, Object> sauResp = sau.loginStart(ticket, platform.wire(), accountName);

        String qrImageDataUrl = stringOrNull(sauResp.get("qrImageDataUrl"));
        String qrUrl = stringOrNull(sauResp.get("qrUrl"));
        Instant expiresAt = parseInstantOrNull(sauResp.get("expiresAt"));
        if (expiresAt == null) expiresAt = Instant.now().plusSeconds(300);

        return new SocialAccountBindInitDto(ticket, qrImageDataUrl, qrUrl, expiresAt);
    }

    /**
     * 轮询扫码状态。
     *
     * sau-service 返回 {status, storageStatePlain?, profile?}：
     *   - "pending"  → 透传
     *   - "expired"  → 透传 (entity 行留 PENDING；下次 init 复用)
     *   - "success"  → 取 storageStatePlain (明文 JSON Map) → 加密 → 落库 → 翻 ACTIVE
     *                  profile 只含 displayName/platformAccountId/avatarUrl 等清洁字段
     */
    @Transactional
    public SocialAccountBindPollResultDto pollBind(String userId, String ticket) {
        SocialAccount entity = repo.findByIdAndUserId(ticket, userId)
                .orElseThrow(() -> BusinessException.notFound("BIND_TICKET_NOT_FOUND",
                        "ticket 无效或不属于当前用户"));

        Map<String, Object> sauResp = sau.loginPoll(ticket);
        String status = stringOrNull(sauResp.get("status"));
        if (status == null) status = "pending";

        switch (status) {
            case "pending":
                return SocialAccountBindPollResultDto.pending();
            case "expired":
                return SocialAccountBindPollResultDto.expired();
            case "success":
                // 取明文 storage_state — 仅本方法局部变量存活
                @SuppressWarnings("unchecked")
                Map<String, Object> plain = (Map<String, Object>) sauResp.get("storageStatePlain");
                if (plain == null || plain.isEmpty()) {
                    throw new BusinessException(HttpStatus.BAD_GATEWAY, "SAU_MISSING_STATE",
                            "sau-service 返回 success 但缺 storageStatePlain");
                }
                @SuppressWarnings("unchecked")
                Map<String, Object> profile = (Map<String, Object>) sauResp.get("profile");

                String ciphertext = secret.encryptStorageState(plain);
                entity.setStorageStateEncrypted(ciphertext);
                entity.setStatus(SocialAccountStatus.ACTIVE);
                entity.setBoundAt(Instant.now());
                entity.setLastVerifiedAt(Instant.now());
                applyProfile(entity, profile, true);
                repo.save(entity);
                return SocialAccountBindPollResultDto.success(SocialAccountDto.from(entity));
            default:
                throw new BusinessException(HttpStatus.BAD_GATEWAY, "SAU_UNKNOWN_STATUS",
                        "sau-service 返回未知 status=" + status);
        }
    }

    /**
     * 取消正在进行的扫码绑定。
     *
     * 用户在前端关闭/取消扫码弹窗时调用：
     *   1. 先调 sau-service /login/cancel 把对应 playwright 进程 (chromium + context) 杀掉
     *   2. 若对应 entity 仍是 PENDING 且尚无密文 cookie，删行避免脏数据
     *      （已经 success 翻 ACTIVE 的不动 —— 那是用户已经成功的账号）
     *
     * 完全幂等：ticket 已过期 / 不属于当前用户 / 行已不存在，均静默成功。
     * sau-service 调用失败也只 warn 不抛 —— 用户感知是 dialog 关上了。
     */
    @Transactional
    public void cancelBind(String userId, String ticket) {
        if (userId == null || userId.isBlank() || ticket == null || ticket.isBlank()) return;
        try {
            sau.loginCancel(ticket);
        } catch (Exception e) {
            // 不阻塞用户：playwright 这边即便没杀掉，sweep_expired 也会 TTL 后兜底
        }
        repo.findByIdAndUserId(ticket, userId).ifPresent(entity -> {
            if (entity.getStatus() == SocialAccountStatus.PENDING
                    && entity.getStorageStateEncrypted() == null) {
                repo.delete(entity);
            }
        });
    }

    @Transactional
    public SocialAccountDto verify(String userId, String accountId) {
        SocialAccount entity = repo.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> BusinessException.notFound("SOCIAL_ACCOUNT_NOT_FOUND",
                        "社交账号不存在"));
        if (entity.getStorageStateEncrypted() == null) {
            throw new BusinessException(HttpStatus.CONFLICT, "ACCOUNT_NOT_BOUND",
                    "账号尚未完成绑定，无可验证的 cookie");
        }

        Map<String, Object> plain = secret.decryptStorageState(entity.getStorageStateEncrypted());
        Map<String, Object> sauResp = sau.verifyAccount(entity.getPlatform().wire(), plain);
        boolean valid = Boolean.TRUE.equals(sauResp.get("valid"));

        if (valid) {
            entity.setStatus(SocialAccountStatus.ACTIVE);
            entity.setLastVerifiedAt(Instant.now());
            // sau-service 可能在 verify 时拿到刷新版 cookie；如果给了就替换
            @SuppressWarnings("unchecked")
            Map<String, Object> refreshed = (Map<String, Object>) sauResp.get("refreshedStorageState");
            if (refreshed != null && !refreshed.isEmpty()) {
                entity.setStorageStateEncrypted(secret.encryptStorageState(refreshed));
            }
            @SuppressWarnings("unchecked")
            Map<String, Object> profile = (Map<String, Object>) sauResp.get("profile");
            applyProfile(entity, profile, false);
        } else {
            entity.setStatus(SocialAccountStatus.EXPIRED);
        }
        repo.save(entity);
        return SocialAccountDto.from(entity);
    }

    @Transactional
    public void unbind(String userId, String accountId) {
        SocialAccount entity = repo.findByIdAndUserId(accountId, userId)
                .orElseThrow(() -> BusinessException.notFound("SOCIAL_ACCOUNT_NOT_FOUND",
                        "社交账号不存在"));
        repo.delete(entity);
    }

    // ── helpers ───────────────────────────────────────────────────────────

    private static void applyProfile(SocialAccount entity, Map<String, Object> profile, boolean clearMissing) {
        if (profile == null || profile.isEmpty()) return;
        applyProfileField(profile, "displayName", clearMissing, entity::setDisplayName);
        applyProfileField(profile, "platformAccountId", clearMissing, entity::setPlatformAccountId);
        applyProfileField(profile, "avatarUrl", clearMissing, entity::setAvatarUrl);
    }

    private static void applyProfileField(Map<String, Object> profile,
                                          String key,
                                          boolean clearMissing,
                                          java.util.function.Consumer<String> setter) {
        String value = stringOrNull(profile.get(key));
        if (value != null || clearMissing) setter.accept(value);
    }

    private static String stringOrNull(Object o) {
        if (o == null) return null;
        String s = o.toString();
        return s.isBlank() ? null : s;
    }

    private static Instant parseInstantOrNull(Object o) {
        if (o == null) return null;
        try {
            return Instant.parse(o.toString());
        } catch (Exception e) {
            return null;
        }
    }
}
