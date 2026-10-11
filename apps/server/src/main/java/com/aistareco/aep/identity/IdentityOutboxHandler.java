package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;

/**
 * 单条账号中心事件的处理（{@code docs/unified-identity-plan.md} §12.4）。
 *
 * <p>独立 bean + {@link Propagation#REQUIRES_NEW}：每条事件一个事务，一条失败不带翻整批。
 *
 * <p>幂等：全部动作都是「按当前状态收敛」——
 * {@code USER_MERGED} 重放时 fromUid 已是墓碑，直接 no-op；
 * {@code USER_CLOSED} 重放时本地已是 DELETED，再写一次同值。
 *
 * <p><b>坏 payload 不允许被静默确认</b>（v0.150）：认识的事件类型但 payload 不合法（缺
 * {@code fromUid}/{@code toUid}/{@code uid}）此前只打一行 WARN 就让游标越过去 ——
 * 那条事件就永远丢了。现在抛 {@link InvalidEventPayloadException}，由
 * {@link IdentityOutboxPoller} 就地停住游标重试，连续失败 5 轮才转入死信并放行。
 */
@Component
public class IdentityOutboxHandler {

    private static final Logger log = LoggerFactory.getLogger(IdentityOutboxHandler.class);

    public static final String EVENT_USER_MERGED = "USER_MERGED";
    public static final String EVENT_USER_CLOSED = "USER_CLOSED";
    public static final String EVENT_PHONE_CHANGED = "PHONE_CHANGED";

    /** 认识的事件类型但 payload 不合法 —— 抛给 poller，由它决定重试还是转死信。 */
    public static class InvalidEventPayloadException extends RuntimeException {
        public InvalidEventPayloadException(String message) {
            super(message);
        }
    }

    private final AepUserRepository userRepo;
    private final IdentityPhoneSyncService phoneSync;

    public IdentityOutboxHandler(AepUserRepository userRepo, IdentityPhoneSyncService phoneSync) {
        this.userRepo = userRepo;
        this.phoneSync = phoneSync;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handle(IdentityCenterClient.OutboxEvent event) {
        if (java.util.Set.of("USER_SUSPENDED", "USER_UNSUSPENDED", "USER_CLOSED", "USER_MERGED", "PHONE_CHANGED", "PROFILE_CHANGED").contains(event.eventType())) {
            String uid = event.uid() != null ? event.uid() : text(event, "uid");
            if ("USER_MERGED".equals(event.eventType())) uid = text(event, "fromUid");
            if (uid == null || uid.isBlank()) throw new InvalidEventPayloadException(event.eventType() + " Missing event UID");
            var existing = userRepo.findByIdentityUidForUpdate(uid);
            if (existing.isPresent()) {
                AepUser local = existing.get();
                if ((local.getIdentityStateEventId() != null && local.getIdentityStateEventId() >= event.id())
                        || java.util.Set.of("CLOSED", "MERGED").contains(local.getIdentityState() == null ? "" : local.getIdentityState())
                        || local.getStatus() == AepUser.UserStatus.DELETED) return;
                local.setIdentityStateEventId(event.id());
                if (java.util.Set.of("USER_SUSPENDED", "USER_CLOSED", "USER_MERGED", "PHONE_CHANGED").contains(event.eventType())) local.setIdentityTokensValidAfter(Instant.now());
                if ("USER_CLOSED".equals(event.eventType())) local.setIdentityState("CLOSED");
                if ("USER_MERGED".equals(event.eventType())) local.setIdentityState("MERGED");
            }
        }
        switch (event.eventType()) {
            case EVENT_USER_MERGED -> handleMerged(event);
            case EVENT_USER_CLOSED -> handleClosed(event);
            case EVENT_PHONE_CHANGED -> handlePhoneChanged(event);
            case "PROFILE_CHANGED" -> handleProfileChanged(event);
            case "USER_SUSPENDED", "USER_UNSUSPENDED" -> handleSuspension(event);
            default -> log.warn("[identity] 未知 outbox 事件类型，跳过 id={} type={}",
                    event.id(), event.eventType());
        }
    }

    public Optional<AepUser> mergedSurvivor(IdentityCenterClient.OutboxEvent event) {
        return userRepo.findByIdentityUid(text(event, "toUid"));
    }

    private void handleSuspension(IdentityCenterClient.OutboxEvent event) {
        String uid = event.uid() != null ? event.uid() : text(event, "uid");
        AepUser user = userRepo.findByIdentityUidForUpdate(uid).orElseGet(() -> {
            Instant now = Instant.now();
            return AepUser.builder().id(java.util.UUID.randomUUID().toString()).username("identity_" + java.util.UUID.randomUUID().toString().replace("-", ""))
                    .identityUid(uid).kind(AepUser.AccountKind.PERSONAL).status(AepUser.UserStatus.ACTIVE).platforms("").createdAt(now).updatedAt(now).build();
        });
        user.setIdentityState("USER_SUSPENDED".equals(event.eventType()) ? "SUSPENDED" : "ACTIVE");
        user.setIdentityStateEventId(event.id());
        if ("USER_SUSPENDED".equals(event.eventType())) user.setIdentityTokensValidAfter(Instant.now());
        userRepo.saveAndFlush(user);
        phoneSync.invalidate();
    }

    private void handleProfileChanged(IdentityCenterClient.OutboxEvent event) {
        String uid = event.uid() != null ? event.uid() : text(event, "uid");
        if (uid == null || uid.isBlank() || event.payload() == null || !event.payload().isObject()) {
            throw new InvalidEventPayloadException("PROFILE_CHANGED payload 不合法 id=" + event.id());
        }
        var payload = event.payload();
        if (payload.has("uid") && (!payload.path("uid").isTextual() || !uid.equals(payload.path("uid").asText()))) {
            throw new InvalidEventPayloadException("PROFILE_CHANGED 主体不一致 id=" + event.id());
        }
        for (String field : new String[]{"displayName", "avatarUrl"}) {
            if (payload.has(field) && !payload.path(field).isNull() && !payload.path(field).isTextual()) {
                throw new InvalidEventPayloadException("PROFILE_CHANGED 字段类型不合法 id=" + event.id());
            }
        }
        phoneSync.invalidate();
        userRepo.findByIdentityUidForUpdate(uid).ifPresent(user -> {
            if (payload.hasNonNull("displayName") && !payload.path("displayName").asText().isBlank()) {
                user.setDisplayName(payload.path("displayName").asText());
            }
            if (payload.has("avatarUrl")) {
                String avatar = payload.path("avatarUrl").isNull() ? null : payload.path("avatarUrl").asText();
                user.setAvatarUrl(avatar == null || avatar.isBlank() ? null : avatar);
            }
            user.setUpdatedAt(Instant.now());
            userRepo.save(user);
        });
    }

    private void handlePhoneChanged(IdentityCenterClient.OutboxEvent event) {
        String uid = event.uid() != null ? event.uid() : text(event, "uid");
        if (uid == null || uid.isBlank()) throw new InvalidEventPayloadException("PHONE_CHANGED 缺 uid id=" + event.id());
        phoneSync.invalidate();
        userRepo.findByIdentityUidForUpdate(uid).ifPresent(user -> {
            // 事件只有脱敏号码，不能拿它覆盖完整号码；先清掉旧展示副本，再由 /userinfo 补齐。
            user.setPhone(null);
            user.setUpdatedAt(Instant.now());
            userRepo.save(user);
        });
    }

    /**
     * A 被并进 B：
     * <ul>
     *   <li>B 在本地还没有档案 → 把 A 的本地档案 {@code identity_uid} 改指 B（业务数据原样留在 A 行）。</li>
     *   <li>B 在本地已有档案 → 两份本地档案不能自动合并（钱包 / 项目 / 资产各一套）：
     *       A 的本地档案保留原 {@code identity_uid} 作墓碑 + {@code status=SUSPENDED}，WARN 出来等人工处理。</li>
     * </ul>
     */
    private void handleMerged(IdentityCenterClient.OutboxEvent event) {
        String fromUid = text(event, "fromUid");
        String toUid = text(event, "toUid");
        if (fromUid == null || toUid == null || fromUid.equals(toUid)) {
            throw new InvalidEventPayloadException(
                    "USER_MERGED payload 不合法 id=" + event.id() + " fromUid=" + fromUid + " toUid=" + toUid);
        }
        phoneSync.invalidate();
        Optional<AepUser> fromLocal = userRepo.findByIdentityUidForUpdate(fromUid);
        if (fromLocal.isEmpty()) {
            createClosedTombstone(fromUid);
            return;
        }
        AepUser local = fromLocal.get();
        if (local.getStatus() == AepUser.UserStatus.DELETED) return; // idempotent tombstone replay
        Optional<AepUser> toLocal = userRepo.findByIdentityUid(toUid);
        if (toLocal.isPresent() && (toLocal.get().getStatus() == AepUser.UserStatus.DELETED || java.util.Set.of("CLOSED", "MERGED").contains(toLocal.get().getIdentityState() == null ? "" : toLocal.get().getIdentityState()))) throw new InvalidEventPayloadException("Merge target disabled");
        if (toLocal.isEmpty()) {
            local.setIdentityUid(toUid);
            local.setIdentityState(null);
            local.setIdentityStateEventId(null);
            local.setPhone(null);
            local.setUpdatedAt(Instant.now());
            userRepo.saveAndFlush(local); // release old UID before its tombstone INSERT
            createClosedTombstone(fromUid);
            log.info("[identity] USER_MERGED 本地档案改指 localUserId={} {} -> {}",
                    local.getId(), fromUid, toUid);
            return;
        }
        // Keep the losing UID as a tombstone; clearing it lets an old valid
        // JWT JIT-provision another account before the token expires.
        local.setPhone(null);
        local.setStatus(AepUser.UserStatus.SUSPENDED);
        local.setUpdatedAt(Instant.now());
        userRepo.save(local);
        log.warn("[identity] USER_MERGED 两侧本地档案都存在，需人工合并业务数据："
                        + "被并方 localUserId={}（已停用、保留旧 uid 墓碑），存活方 localUserId={} uid {} -> {}",
                local.getId(), toLocal.get().getId(), fromUid, toUid);
    }

    /** 账号中心注销：本地档案标 DELETED，{@code identity_uid} 保留作墓碑（同号冷静期内不复活）。 */
    private void handleClosed(IdentityCenterClient.OutboxEvent event) {
        String uid = event.uid() != null ? event.uid() : text(event, "uid");
        if (uid == null || uid.isBlank()) {
            throw new InvalidEventPayloadException("USER_CLOSED payload 缺 uid id=" + event.id());
        }
        Optional<AepUser> local = userRepo.findByIdentityUidForUpdate(uid);
        if (local.isEmpty()) {
            createClosedTombstone(uid);
            return;
        }
        AepUser user = local.get();
        user.setStatus(AepUser.UserStatus.DELETED);
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
        log.info("[identity] USER_CLOSED 本地档案标记删除 localUserId={} uid={}", user.getId(), uid);
    }

    private void createClosedTombstone(String uid) {
        Instant now = Instant.now();
        AepUser tombstone = AepUser.builder()
                .id(java.util.UUID.randomUUID().toString())
                .username("closed_" + java.util.UUID.randomUUID().toString().replace("-", ""))
                .identityUid(uid).kind(AepUser.AccountKind.PERSONAL)
                .status(AepUser.UserStatus.DELETED).platforms("")
                .emailVerified(false).phoneVerified(false)
                .createdAt(now).updatedAt(now).build();
        // Same event transaction: a racing JIT unique-key conflict rolls back
        // and retries the event; no enrollment, wallet or product link created.
        userRepo.saveAndFlush(tombstone);
    }

    private static String text(IdentityCenterClient.OutboxEvent event, String field) {
        if (event.payload() == null) return null;
        var node = event.payload().path(field);
        String value = node.isTextual() ? node.asText() : null;
        return value == null || value.isBlank() ? null : value;
    }
}
