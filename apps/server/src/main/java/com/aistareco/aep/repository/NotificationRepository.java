package com.aistareco.aep.repository;

import com.aistareco.aep.model.Notification;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, String> {

    List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);

    /** v0.58：运营收件箱分页（userId = {@link Notification#ADMIN_INBOX_USER_ID}）。 */
    Page<Notification> findByUserId(String userId, Pageable pageable);

    /** v0.58：未读行（admin「全部标记已读」批量落 viewedAt 用）。 */
    List<Notification> findByUserIdAndViewedAtIsNull(String userId);

    /** v0.5.1：按 userId+botId 聚合的全量列表（用于按 Bot 取最新预览）。 */
    List<Notification> findByUserIdAndBotIdOrderByCreatedAtDesc(String userId, String botId);

    /**
     * 未读计数（用于消息首页 Bot 行红点 dot）。
     *
     * v0.34.x：从 ReadFalse 改成 ViewedAtIsNull 对齐新 viewedAt 字段
     *   原: countByUserIdAndBotIdAndReadFalse        (read=false → 未读)
     *   新: countByUserIdAndBotIdAndViewedAtIsNull   (viewed_at IS NULL → 未读)
     */
    long countByUserIdAndBotIdAndViewedAtIsNull(String userId, String botId);
}
