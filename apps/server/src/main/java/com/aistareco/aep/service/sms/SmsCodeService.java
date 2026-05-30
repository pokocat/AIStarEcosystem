package com.aistareco.aep.service.sms;

import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * v0.31+ SMS 验证码生成 / 校验 / 速率限制 / 失败锁定 —— 全部 in-memory。
 *
 * <p>不引入 Redis 的原因：单实例 dev/MVP 够用；重启丢失少数用户的码可接受（用户重发即可）。
 * 多实例 prod 部署前需要换成 Redis（共享状态）。
 *
 * <p>状态条目按手机号 key：
 * <ul>
 *   <li>{@link CodeEntry#code}     当前有效验证码（plain text，in-memory only）</li>
 *   <li>{@link CodeEntry#sentAt}   发送时间（用于 ttl + rate-limit）</li>
 *   <li>{@link CodeEntry#failures} 累计失败次数（达到 maxFailures 后锁定）</li>
 *   <li>{@link CodeEntry#lockedUntil} 锁定到期时间（null = 未锁）</li>
 * </ul>
 */
@Service
public class SmsCodeService {

    private static final Logger log = LoggerFactory.getLogger(SmsCodeService.class);
    /** 内地手机号宽松校验（11 位以 1 开头）；接入海外号需重写。 */
    private static final Pattern PHONE = Pattern.compile("^1\\d{10}$");
    private static final SecureRandom RND = new SecureRandom();

    private final SmsSender sender;
    private final int codeLength;
    private final long ttlSeconds;
    private final long rateLimitSeconds;
    private final int maxFailures;
    private final long lockSeconds;
    /** v0.31+: dev 固定测试码（仅 driver=log 时生效；空字符串=不启用）。 */
    private final String devFixedCode;
    /** v0.31+: 启动时缓存「真生效中」的固定码（双门禁通过 + 已 trim）；非空表示启用。 */
    private final String effectiveFixedCode;

    private final Map<String, CodeEntry> store = new ConcurrentHashMap<>();

    public SmsCodeService(SmsSender sender,
                          @Value("${aep.sms.code.length:6}") int codeLength,
                          @Value("${aep.sms.code.ttl-seconds:300}") long ttlSeconds,
                          @Value("${aep.sms.code.rate-limit-seconds:60}") long rateLimitSeconds,
                          @Value("${aep.sms.code.max-failures:5}") int maxFailures,
                          @Value("${aep.sms.code.lock-seconds:1800}") long lockSeconds,
                          @Value("${aep.sms.driver:log}") String driver,
                          @Value("${aep.sms.code.dev-fixed:}") String devFixedCode) {
        this.sender = sender;
        this.codeLength = codeLength;
        this.ttlSeconds = ttlSeconds;
        this.rateLimitSeconds = rateLimitSeconds;
        this.maxFailures = maxFailures;
        this.lockSeconds = lockSeconds;
        this.devFixedCode = devFixedCode == null ? "" : devFixedCode.trim();
        // 严格双门禁：driver 必须是 log 且 devFixedCode 非空 → 生效
        boolean isLogDriver = "log".equalsIgnoreCase(driver == null ? "" : driver.trim());
        if (isLogDriver && !this.devFixedCode.isEmpty()) {
            // 简单校验：长度与 codeLength 匹配 + 全数字（防配错）
            if (!this.devFixedCode.matches("\\d+")) {
                throw new IllegalStateException("aep.sms.code.dev-fixed 必须是纯数字");
            }
            if (this.devFixedCode.length() != codeLength) {
                throw new IllegalStateException(
                        "aep.sms.code.dev-fixed 长度必须等于 aep.sms.code.length=" + codeLength
                                + "，当前 dev-fixed 长度=" + this.devFixedCode.length());
            }
            this.effectiveFixedCode = this.devFixedCode;
        } else {
            this.effectiveFixedCode = "";
        }
    }

    @PostConstruct
    void warnIfFixedCodeEnabled() {
        if (!effectiveFixedCode.isEmpty()) {
            log.warn("[sms-code] ⚠️  DEV-FIXED CODE ENABLED — all phones will receive code={} ; "
                            + "driver=log only ; 切到 aliyun driver 时会自动失效",
                    effectiveFixedCode);
        } else if (!devFixedCode.isEmpty()) {
            // 配了 dev-fixed 但 driver 不是 log → 忽略，告知
            log.warn("[sms-code] aep.sms.code.dev-fixed 已配置但 driver != log，已忽略；"
                    + "如需启用请同时配 AEP_SMS_DRIVER=log");
        }
    }

    /**
     * 发送一个新的验证码。会做：手机号格式校验 → 速率限制 → 锁定状态 → 生成 → SmsSender 调用 → 存储。
     * 失败抛 BusinessException（4xx 透传给前端）。
     */
    public void requestCode(String phone) {
        validatePhone(phone);
        Instant now = Instant.now();
        CodeEntry existing = store.get(phone);
        if (existing != null) {
            if (existing.lockedUntil != null && existing.lockedUntil.isAfter(now)) {
                long waitMin = Math.max(1, java.time.Duration.between(now, existing.lockedUntil).toMinutes());
                log.warn("[sms-code] request blocked locked phone={} waitMin={}", phone, waitMin);
                throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "SMS_CODE_LOCKED",
                        "手机号已被临时锁定，请 " + waitMin + " 分钟后再试");
            }
            long elapsedSec = java.time.Duration.between(existing.sentAt, now).getSeconds();
            if (elapsedSec < rateLimitSeconds) {
                long wait = rateLimitSeconds - elapsedSec;
                log.warn("[sms-code] request rate-limited phone={} waitSeconds={}", phone, wait);
                throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "SMS_CODE_RATE_LIMITED",
                        "短信发送过于频繁，请 " + wait + " 秒后再试");
            }
        }
        String code = generateCode();
        try {
            sender.sendVerificationCode(phone, code);
        } catch (SmsSender.SmsSendException e) {
            log.warn("[sms-code] send failed phone={} err={}", phone, e.getMessage());
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "SMS_SEND_FAILED",
                    "短信发送失败：" + e.getMessage());
        }
        CodeEntry entry = new CodeEntry();
        entry.code = code;
        entry.sentAt = now;
        entry.failures = 0;
        entry.lockedUntil = null;
        store.put(phone, entry);
        log.info("[sms-code] verification code sent phone={} ttlSeconds={}", phone, ttlSeconds);
    }

    /**
     * 校验验证码。成功后**立即删除** entry（防止重放）。失败 → 累计错误，到阈值时锁定。
     * 失败抛 BusinessException；成功无返回。
     */
    public void verifyCode(String phone, String code) {
        validatePhone(phone);
        if (code == null || code.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SMS_CODE_REQUIRED", "请输入验证码");
        }
        Instant now = Instant.now();
        CodeEntry entry = store.get(phone);
        if (entry == null) {
            log.warn("[sms-code] verify without requested code phone={}", phone);
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SMS_CODE_NOT_REQUESTED",
                    "请先获取验证码");
        }
        if (entry.lockedUntil != null && entry.lockedUntil.isAfter(now)) {
            long waitMin = Math.max(1, java.time.Duration.between(now, entry.lockedUntil).toMinutes());
            log.warn("[sms-code] verify blocked locked phone={} waitMin={}", phone, waitMin);
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "SMS_CODE_LOCKED",
                    "手机号已被临时锁定，请 " + waitMin + " 分钟后再试");
        }
        long elapsed = java.time.Duration.between(entry.sentAt, now).getSeconds();
        if (elapsed > ttlSeconds) {
            store.remove(phone);
            log.info("[sms-code] verify expired phone={} elapsedSeconds={}", phone, elapsed);
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SMS_CODE_EXPIRED",
                    "验证码已过期，请重新获取");
        }
        if (!entry.code.equals(code.trim())) {
            entry.failures++;
            if (entry.failures >= maxFailures) {
                entry.lockedUntil = now.plusSeconds(lockSeconds);
                entry.code = "";   // 清空 code 防侧通道继续比对
                log.warn("[sms-code] verify failed and locked phone={} failures={} lockSeconds={}",
                        phone, entry.failures, lockSeconds);
                throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "SMS_CODE_LOCKED",
                        "错误次数过多，手机号已被锁定 " + (lockSeconds / 60) + " 分钟");
            }
            int remain = maxFailures - entry.failures;
            log.warn("[sms-code] verify failed phone={} failures={} remaining={}",
                    phone, entry.failures, remain);
            throw new BusinessException(HttpStatus.BAD_REQUEST, "SMS_CODE_INVALID",
                    "验证码错误，剩余 " + remain + " 次机会");
        }
        // 成功 → 删除 entry，防止同一码被重用
        store.remove(phone);
        log.info("[sms-code] verification code verified phone={}", phone);
    }

    /** 每分钟清理过期 / 已锁定到期的 entry，避免内存累积。 */
    @Scheduled(fixedDelay = 60_000, initialDelay = 60_000)
    public void cleanup() {
        Instant now = Instant.now();
        int removed = 0;
        var it = store.entrySet().iterator();
        while (it.hasNext()) {
            var e = it.next();
            CodeEntry v = e.getValue();
            boolean expired = java.time.Duration.between(v.sentAt, now).getSeconds() > ttlSeconds;
            boolean lockExpired = v.lockedUntil != null && v.lockedUntil.isBefore(now);
            if ((expired && (v.lockedUntil == null || lockExpired)) || (lockExpired && v.code.isEmpty())) {
                it.remove();
                removed++;
            }
        }
        if (removed > 0) {
            log.debug("[sms-code] cleanup removed {} stale entries; remaining={}", removed, store.size());
        }
    }

    private void validatePhone(String phone) {
        if (phone == null || !PHONE.matcher(phone.trim()).matches()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PHONE_INVALID",
                    "手机号格式不正确（仅支持 11 位国内号）");
        }
    }

    private String generateCode() {
        // v0.31+: dev-fixed 已通过双门禁（log driver + 非空）则直接返回固定码
        if (!effectiveFixedCode.isEmpty()) return effectiveFixedCode;
        StringBuilder sb = new StringBuilder(codeLength);
        for (int i = 0; i < codeLength; i++) sb.append(RND.nextInt(10));
        return sb.toString();
    }

    private static class CodeEntry {
        String code;
        Instant sentAt;
        int failures;
        Instant lockedUntil;
    }
}
