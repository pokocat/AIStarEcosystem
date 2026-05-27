package com.aistareco.aep.controller;

import com.aistareco.aep.dto.NotificationDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.Notification;
import com.aistareco.aep.repository.NotificationRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;

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
        return PageEnvelope.from(repo.findAll(pageable).map(NotificationDto::from));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<NotificationDto> markAsRead(@PathVariable String id) {
        Notification n = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "通知不存在"));
        // 已读不可逆：仅当未读时设置时间戳，避免管理员重复点击改写首次读时间
        if (n.getViewedAt() == null) {
            n.setViewedAt(Instant.now());
            repo.save(n);
        }
        return ApiResponse.of(NotificationDto.from(n));
    }
}
