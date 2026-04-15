package com.aistareco.aep.service;

import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.security.AdminPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Service;

@Service
public class AdminAuditRecorder {

    private final AuditService auditService;

    public AdminAuditRecorder(AuditService auditService) {
        this.auditService = auditService;
    }

    public void success(
            AdminPrincipal principal,
            HttpServletRequest request,
            String action,
            String resourceType,
            String resourceId,
            String detail
    ) {
        auditService.record(
                principal != null ? principal.userId() : null,
                null,
                action,
                resourceType,
                resourceId,
                request.getRemoteAddr(),
                request.getHeader("User-Agent"),
                AuditLog.AuditResult.SUCCESS,
                detail
        );
    }
}
