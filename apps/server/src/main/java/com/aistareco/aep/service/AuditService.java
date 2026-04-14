package com.aistareco.aep.service;

import com.aistareco.aep.dto.AuditLogDto;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditRepo;

    public AuditService(AuditLogRepository auditRepo) {
        this.auditRepo = auditRepo;
    }

    public Page<AuditLogDto> list(String userId, String action, AuditLog.AuditResult result, Pageable pageable) {
        Page<AuditLog> page;
        if (userId != null && action != null && result != null) {
            page = auditRepo.findByUserIdAndActionAndResult(userId, action, result, pageable);
        } else if (userId != null && action != null) {
            page = auditRepo.findByUserIdAndAction(userId, action, pageable);
        } else if (userId != null && result != null) {
            page = auditRepo.findByUserIdAndResult(userId, result, pageable);
        } else if (action != null && result != null) {
            page = auditRepo.findByActionAndResult(action, result, pageable);
        } else if (userId != null) {
            page = auditRepo.findByUserId(userId, pageable);
        } else if (action != null) {
            page = auditRepo.findByAction(action, pageable);
        } else if (result != null) {
            page = auditRepo.findByResult(result, pageable);
        } else {
            page = auditRepo.findAll(pageable);
        }
        return page.map(AuditLogDto::from);
    }

    public AuditLog record(String userId, String tenantId, String action,
                            String resourceType, String resourceId,
                            String ipAddress, String userAgent,
                            AuditLog.AuditResult result, String detail) {
        AuditLog log = AuditLog.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .tenantId(tenantId)
                .action(action)
                .resourceType(resourceType)
                .resourceId(resourceId)
                .ipAddress(ipAddress)
                .userAgent(userAgent)
                .result(result)
                .detail(detail)
                .createdAt(Instant.now())
                .build();
        return auditRepo.save(log);
    }
}
