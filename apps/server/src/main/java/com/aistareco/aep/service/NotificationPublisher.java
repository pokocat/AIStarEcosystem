package com.aistareco.aep.service;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Notification;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.NotificationRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

/**
 * 站内消息发布器（v0.58）。业务事件 → {@code aep_notifications} 的唯一写入口：
 *
 * <ul>
 *   <li>{@link #notifyAdmins} — 写进运营收件箱（userId = {@link Notification#ADMIN_INBOX_USER_ID}），
 *       admin「消息中心」消费；audience 标注触发事件的个人账号，方便溯源。</li>
 *   <li>{@link #notifyUser} — 写给具体用户，前端 /api/notifications 列表消费。</li>
 * </ul>
 *
 * 站内消息是旁路写入（观测类）：发布失败只 WARN 不抛，绝不阻塞充值下单 / 核准等业务主链路
 * （AGENTS.md §8.0 允许的例外——丢一条消息可接受，业务回滚不可接受）。
 */
@Service
public class NotificationPublisher {

    private static final Logger log = LoggerFactory.getLogger(NotificationPublisher.class);

    private final NotificationRepository notificationRepo;
    private final AepUserRepository userRepo;

    public NotificationPublisher(NotificationRepository notificationRepo, AepUserRepository userRepo) {
        this.notificationRepo = notificationRepo;
        this.userRepo = userRepo;
    }

    /**
     * 给运营收件箱发一条消息，audience 指向触发事件的个人账号。
     *
     * @param accountUserId 触发事件的用户 id（写入 audience.targetId；可为 null）
     */
    public void notifyAdmins(Notification.NotificationType type, String title, String description,
                             String accountUserId) {
        try {
            String targetName = null;
            if (accountUserId != null) {
                AepUser u = userRepo.findById(accountUserId).orElse(null);
                if (u != null) {
                    targetName = u.getDisplayName() != null && !u.getDisplayName().isBlank()
                            ? u.getDisplayName() : u.getUsername();
                }
            }
            notificationRepo.save(Notification.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(Notification.ADMIN_INBOX_USER_ID)
                    .type(type)
                    .title(title)
                    .description(description)
                    .audienceScope(accountUserId != null ? "account" : "all")
                    .audienceTargetId(accountUserId)
                    .audienceTargetName(targetName)
                    .createdAt(Instant.now())
                    .build());
        } catch (Exception e) {
            log.warn("[notify] admin inbox publish failed title={} : {}", title, e.toString());
        }
    }

    /** 给具体用户发一条站内消息（用户端通知中心消费）。 */
    public void notifyUser(String userId, Notification.NotificationType type, String title, String description) {
        if (userId == null || userId.isBlank()) return;
        try {
            notificationRepo.save(Notification.builder()
                    .id(UUID.randomUUID().toString())
                    .userId(userId)
                    .type(type)
                    .title(title)
                    .description(description)
                    .audienceScope("account")
                    .audienceTargetId(userId)
                    .createdAt(Instant.now())
                    .build());
        } catch (Exception e) {
            log.warn("[notify] user publish failed userId={} title={} : {}", userId, title, e.toString());
        }
    }
}
