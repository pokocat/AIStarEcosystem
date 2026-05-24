package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ErrorLogDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.ErrorLog;
import com.aistareco.aep.repository.ErrorLogRepository;
import com.aistareco.common.BusinessException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * 错误日志查询接口（admin 后台用）。
 *
 * Security：仅 SUPER_ADMIN 可访问。AepSecurityConfig 用更具体的 matcher（在通用 /api/admin/** 之前）
 * 把 /api/admin/error-logs/** 限定到 hasRole("SUPER_ADMIN")，OPERATOR 角色访问 403。
 */
@RestController
@RequestMapping("/api/admin/error-logs")
public class AdminErrorLogController {

    private final ErrorLogRepository repo;

    public AdminErrorLogController(ErrorLogRepository repo) {
        this.repo = repo;
    }

    /**
     * 分页 + 多条件过滤。任何 query param 缺省 = 该维度不过滤。
     *
     * 排序：固定按 occurredAt DESC（最新错误最有价值）。
     * 单页上限：100。
     */
    @GetMapping
    public PageEnvelope<ErrorLogDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String endpoint,
            @RequestParam(required = false) Integer httpStatus,
            @RequestParam(required = false) String hostname,
            @RequestParam(required = false) String since,
            @RequestParam(required = false) String until
    ) {
        int safeSize = Math.min(Math.max(size, 1), 100);
        int safePage = Math.max(page, 0);
        Instant sinceInstant = parseInstantOrNull(since, "since");
        Instant untilInstant = parseInstantOrNull(until, "until");

        PageRequest pageable = PageRequest.of(safePage, safeSize, Sort.by("occurredAt").descending());
        Page<ErrorLog> result = repo.search(
                blankToNull(userId),
                blankToNull(endpoint),
                httpStatus,
                blankToNull(hostname),
                sinceInstant,
                untilInstant,
                pageable
        );
        return PageEnvelope.from(result.map(ErrorLogDto::from));
    }

    /** 凭 logId 单条查（用户报错时直接用追查号查）。 */
    @GetMapping("/by-log-id/{logId}")
    public ErrorLogDto findByLogId(@PathVariable String logId) {
        return repo.findByLogId(logId)
                .map(ErrorLogDto::from)
                .orElseThrow(() -> BusinessException.notFound("ERROR_LOG_NOT_FOUND",
                        "未找到追查号为 " + logId + " 的错误日志"));
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static Instant parseInstantOrNull(String s, String name) {
        if (s == null || s.isBlank()) return null;
        try {
            return Instant.parse(s.trim());
        } catch (DateTimeParseException ex) {
            throw BusinessException.badRequest("INVALID_TIME",
                    name + " 必须是 ISO-8601 时间格式（如 2026-05-23T00:00:00Z）");
        }
    }
}
