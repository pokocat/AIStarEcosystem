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
 * {@code USER_MERGED} 重放时 fromUid 已不再挂在任何本地档案上，直接 no-op；
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

    public IdentityOutboxHandler(AepUserRepository userRepo) {
        this.userRepo = userRepo;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void handle(IdentityCenterClient.OutboxEvent event) {
        switch (event.eventType()) {
            case EVENT_USER_MERGED -> handleMerged(event);
            case EVENT_USER_CLOSED -> handleClosed(event);
            case EVENT_PHONE_CHANGED -> log.debug("[identity] 忽略 PHONE_CHANGED（本地不存账号中心手机号） id={}",
                    event.id());
            default -> log.warn("[identity] 未知 outbox 事件类型，跳过 id={} type={}",
                    event.id(), event.eventType());
        }
    }

    /**
     * A 被并进 B：
     * <ul>
     *   <li>B 在本地还没有档案 → 把 A 的本地档案 {@code identity_uid} 改指 B（业务数据原样留在 A 行）。</li>
     *   <li>B 在本地已有档案 → 两份本地档案不能自动合并（钱包 / 项目 / 资产各一套）：
     *       A 的本地档案 {@code identity_uid=null} + {@code status=SUSPENDED}，WARN 出来等人工处理。</li>
     * </ul>
     */
    private void handleMerged(IdentityCenterClient.OutboxEvent event) {
        String fromUid = text(event, "fromUid");
        String toUid = text(event, "toUid");
        if (fromUid == null || toUid == null || fromUid.equals(toUid)) {
            throw new InvalidEventPayloadException(
                    "USER_MERGED payload 不合法 id=" + event.id() + " fromUid=" + fromUid + " toUid=" + toUid);
        }
        Optional<AepUser> fromLocal = userRepo.findByIdentityUid(fromUid);
        if (fromLocal.isEmpty()) {
            log.debug("[identity] USER_MERGED 无本地档案，忽略 id={} from={}", event.id(), fromUid);
            return;
        }
        AepUser local = fromLocal.get();
        Optional<AepUser> toLocal = userRepo.findByIdentityUid(toUid);
        if (toLocal.isEmpty()) {
            local.setIdentityUid(toUid);
            local.setUpdatedAt(Instant.now());
            userRepo.save(local);
            log.info("[identity] USER_MERGED 本地档案改指 localUserId={} {} -> {}",
                    local.getId(), fromUid, toUid);
            return;
        }
        local.setIdentityUid(null);
        local.setStatus(AepUser.UserStatus.SUSPENDED);
        local.setUpdatedAt(Instant.now());
        userRepo.save(local);
        log.warn("[identity] USER_MERGED 两侧本地档案都存在，需人工合并业务数据："
                        + "被并方 localUserId={}（已停用、解绑 uid），存活方 localUserId={} uid {} -> {}",
                local.getId(), toLocal.get().getId(), fromUid, toUid);
    }

    /** 账号中心注销：本地档案标 DELETED，{@code identity_uid} 保留作墓碑（同号冷静期内不复活）。 */
    private void handleClosed(IdentityCenterClient.OutboxEvent event) {
        String uid = event.uid() != null ? event.uid() : text(event, "uid");
        if (uid == null) {
            throw new InvalidEventPayloadException("USER_CLOSED payload 缺 uid id=" + event.id());
        }
        Optional<AepUser> local = userRepo.findByIdentityUid(uid);
        if (local.isEmpty()) {
            log.debug("[identity] USER_CLOSED 无本地档案，忽略 id={} uid={}", event.id(), uid);
            return;
        }
        AepUser user = local.get();
        user.setStatus(AepUser.UserStatus.DELETED);
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
        log.info("[identity] USER_CLOSED 本地档案标记删除 localUserId={} uid={}", user.getId(), uid);
    }

    private static String text(IdentityCenterClient.OutboxEvent event, String field) {
        if (event.payload() == null) return null;
        String value = event.payload().path(field).asText(null);
        return value == null || value.isBlank() ? null : value;
    }
}
