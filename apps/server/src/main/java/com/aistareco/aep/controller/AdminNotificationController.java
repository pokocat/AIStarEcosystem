package com.aistareco.aep.controller;

import com.aistareco.aep.dto.NotificationDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.Notification;
import com.aistareco.aep.repository.NotificationRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 运营收件箱（v0.58 真实化）。
 *
 * 只读写 userId = {@link Notification#ADMIN_INBOX_USER_ID} 的行——真实业务事件
 * （充值下单 / 取消等）由 {@link com.aistareco.aep.service.NotificationPublisher} 写入。
 * 不再 findAll 混入各用户的个人通知：那会让运营标已读时改写用户自己的未读状态。
 */
@RestController
@RequestMapping("/api/admin/notifications")
public class AdminNotificationController {

    private final NotificationRepository repo;

    public AdminNotificationController(NotificationRepository repo) {
        this.repo = repo;
    }

    @GetMapping
    public PageEnvelope<NotificationDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(repo.findByUserId(Notification.ADMIN_INBOX_USER_ID, pageable)
                .map(NotificationDto::from));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<NotificationDto> markAsRead(@PathVariable String id) {
        Notification n = loadAdminOwned(id);
        // 已读不可逆：仅当未读时设置时间戳，避免管理员重复点击改写首次读时间
        if (n.getViewedAt() == null) {
            n.setViewedAt(Instant.now());
            repo.save(n);
        }
        return ApiResponse.of(NotificationDto.from(n));
    }

    /** v0.58：全部标记已读（仅运营收件箱行）。返回本次落 viewedAt 的条数。 */
    @PostMapping("/read-all")
    @Transactional
    public ApiResponse<Map<String, Object>> markAllRead() {
        List<Notification> unread = repo.findByUserIdAndViewedAtIsNull(Notification.ADMIN_INBOX_USER_ID);
        Instant now = Instant.now();
        for (Notification n : unread) {
            n.setViewedAt(now);
        }
        if (!unread.isEmpty()) repo.saveAll(unread);
        return ApiResponse.of(Map.of("updated", unread.size()));
    }

    /** 只允许操作运营收件箱的行；防止误改用户个人通知的已读状态。 */
    private Notification loadAdminOwned(String id) {
        Notification n = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "通知不存在"));
        if (!Notification.ADMIN_INBOX_USER_ID.equals(n.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该通知属于用户个人收件箱，无法在运营后台操作");
        }
        return n;
    }
}
