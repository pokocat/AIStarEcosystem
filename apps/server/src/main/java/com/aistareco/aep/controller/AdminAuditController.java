package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AuditLogDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.service.AuditService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/admin/audit-logs")
public class AdminAuditController {

    private final AuditService auditService;

    public AdminAuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    /**
     * v0.47：扩展过滤维度（含 actions / username / ipAddress / errorCode / since / until）。
     * 老调用 {@code ?action=xxx} 单值兼容：actions 为空则降级到旧的 (userId, action, result) 三维度入口。
     *
     * @param actions   逗号分隔的动作列表，如 {@code admin.login,auth.sms.login}；空则不过滤动作维度
     * @param scope     便捷预设：{@code auth-all} 一键 = AuditService.Actions.AUTH_ALL（登录注册全集）
     * @param since/until ISO-8601；如 {@code 2026-06-01T00:00:00Z}
     */
    @GetMapping
    public PageEnvelope<AuditLogDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String username,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String actions,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String ipAddress,
            @RequestParam(required = false) String appCode,
            @RequestParam(required = false) String errorCode,
            @RequestParam(required = false) String result,
            @RequestParam(required = false) String since,
            @RequestParam(required = false) String until) {

        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 0);
        AuditLog.AuditResult resultEnum = parseResult(result);
        PageRequest pageable = PageRequest.of(safePage, safeSize, Sort.by("createdAt").descending());

        List<String> actionList = resolveActions(actions, scope, action);
        if (actionList != null
                || hasText(username) || hasText(ipAddress) || hasText(appCode) || hasText(errorCode)
                || hasText(since) || hasText(until)) {
            Instant sinceInstant = parseInstantOrNull(since, "since");
            Instant untilInstant = parseInstantOrNull(until, "until");
            return PageEnvelope.from(auditService.search(
                    actionList,
                    blankToNull(userId),
                    blankToNull(username),
                    blankToNull(ipAddress),
                    blankToNull(appCode),
                    resultEnum,
                    blankToNull(errorCode),
                    sinceInstant, untilInstant,
                    pageable));
        }

        // 老路径兼容：保留旧的 (userId, action, result) 入口，不带新维度时走老查询，避免对旧 mock 数据 SQL 兼容性问题
        return PageEnvelope.from(auditService.list(
                blankToNull(userId), blankToNull(action), resultEnum, pageable));
    }

    private static List<String> resolveActions(String actionsCsv, String scope, String legacyAction) {
        if (hasText(scope) && "auth-all".equalsIgnoreCase(scope.trim())) {
            return AuditService.Actions.AUTH_ALL;
        }
        if (hasText(actionsCsv)) {
            List<String> parsed = Arrays.stream(actionsCsv.split(","))
                    .map(String::trim)
                    .filter(s -> !s.isBlank())
                    .toList();
            return parsed.isEmpty() ? null : parsed;
        }
        // 新调用方式下仅给单 action 也走 search()：搜索时 action 维度过滤更显式
        if (hasText(legacyAction) && (hasText(scope) || hasText(actionsCsv))) {
            return List.of(legacyAction.trim());
        }
        return null;
    }

    private AuditLog.AuditResult parseResult(String result) {
        if (result == null || result.isBlank()) {
            return null;
        }

        try {
            return AuditLog.AuditResult.valueOf(result.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的审计结果筛选值");
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static boolean hasText(String s) {
        return s != null && !s.isBlank();
    }

    private static Instant parseInstantOrNull(String s, String name) {
        if (!hasText(s)) return null;
        try {
            return Instant.parse(s.trim());
        } catch (DateTimeParseException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    name + " 必须是 ISO-8601 时间格式（如 2026-05-23T00:00:00Z）");
        }
    }
}
