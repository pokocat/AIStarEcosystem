package com.aistareco.aep.controller;

import com.aistareco.aep.dto.BotConversationDto;
import com.aistareco.aep.dto.NotificationDto;
import com.aistareco.aep.model.Notification;
import com.aistareco.aep.repository.NotificationRepository;
import com.aistareco.aep.service.NotificationService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * 当前用户的通知中心：/api/notifications/*。
 * 管理写入（面向所有用户）仍走 {@link AdminNotificationController}。
 */
@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository repo;
    private final NotificationService botService;

    public NotificationController(NotificationRepository repo, NotificationService botService) {
        this.repo = repo;
        this.botService = botService;
    }

    @GetMapping
    public ApiResponse<List<NotificationDto>> list(Principal principal) {
        List<NotificationDto> items = repo.findByUserIdOrderByCreatedAtDesc(principal.getName())
                .stream().map(NotificationDto::from).toList();
        return ApiResponse.of(items);
    }

    @PostMapping("/{id}/read")
    public ApiResponse<NotificationDto> markRead(Principal principal, @PathVariable String id) {
        Notification n = loadOwned(id, principal.getName());
        n.setRead(true);
        repo.save(n);
        return ApiResponse.of(NotificationDto.from(n));
    }

    @PostMapping("/read-all")
    @Transactional
    public ApiResponse<Map<String, Object>> markAllRead(Principal principal) {
        List<Notification> mine = repo.findByUserIdOrderByCreatedAtDesc(principal.getName());
        int updated = 0;
        for (Notification n : mine) {
            if (!n.isRead()) {
                n.setRead(true);
                updated++;
            }
        }
        if (updated > 0) repo.saveAll(mine);
        return ApiResponse.of(Map.of("updated", updated));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Principal principal, @PathVariable String id) {
        Notification n = loadOwned(id, principal.getName());
        repo.delete(n);
    }

    /** v0.4：取单个 AI Bot 的多消息会话流（小程序 chat 页消费）。 */
    @GetMapping("/conversations/{botId}")
    public ApiResponse<BotConversationDto> getConversation(@PathVariable String botId) {
        return ApiResponse.of(botService.getConversation(botId));
    }

    /**
     * v0.5.1：把当前用户对该 Bot 的所有 Notification 标已读。chat 页打开时调用，清掉首页红点。
     */
    @PostMapping("/conversations/{botId}/read-all")
    public ApiResponse<Map<String, Object>> markBotRead(Principal principal, @PathVariable String botId) {
        String uid = principal != null ? principal.getName() : "demo-user";
        int updated = botService.markBotConversationRead(uid, botId);
        return ApiResponse.of(Map.of("updated", updated, "botId", botId));
    }

    private Notification loadOwned(String id, String userId) {
        Notification n = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "通知不存在"));
        if (!userId.equals(n.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "无权操作该通知");
        }
        return n;
    }
}
