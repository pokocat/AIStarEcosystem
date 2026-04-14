package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AuditLogDto;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin/audit-logs")
public class AdminAuditController {

    private final AuditService auditService;

    public AdminAuditController(AuditService auditService) {
        this.auditService = auditService;
    }

    @GetMapping
    public ApiResponse<Page<AuditLogDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String result) {

        AuditLog.AuditResult resultEnum = result != null ? AuditLog.AuditResult.valueOf(result) : null;
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(auditService.list(userId, action, resultEnum, pageable));
    }
}
