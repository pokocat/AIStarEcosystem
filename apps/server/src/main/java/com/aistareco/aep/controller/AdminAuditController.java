package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AuditLogDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/admin/audit-logs")
public class AdminAuditController {

    private final AuditService auditService;

    public AdminAuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    public ApiResponse<PageEnvelope<AuditLogDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String result) {

        AuditLog.AuditResult resultEnum = parseResult(result);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(auditService.list(userId, action, resultEnum, pageable)));
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
}
