package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminStatsDto;
import com.aistareco.aep.model.LicenseKey;
import com.aistareco.aep.model.Tenant;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.AuditLogRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.LicenseKeyRepository;
import com.aistareco.aep.repository.TenantRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/stats")
public class AdminStatsController {

    private final AepUserRepository userRepo;
    private final TenantRepository tenantRepo;
    private final LicenseKeyRepository licenseKeyRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final AuditLogRepository auditRepo;

    public AdminStatsController(AepUserRepository userRepo,
                                 TenantRepository tenantRepo,
                                 LicenseKeyRepository licenseKeyRepo,
                                 LedgerEntryRepository ledgerRepo,
                                 AuditLogRepository auditRepo) {
        this.userRepo = userRepo;
        this.tenantRepo = tenantRepo;
        this.licenseKeyRepo = licenseKeyRepo;
        this.ledgerRepo = ledgerRepo;
        this.auditRepo = auditRepo;
    }

    @GetMapping
    public ApiResponse<AdminStatsDto> getStats() {
        long totalUsers         = userRepo.count();
        long activeTenants      = tenantRepo.countByStatus(Tenant.TenantStatus.ACTIVE);
        long activeLicenses     = licenseKeyRepo.countByStatus(LicenseKey.LicenseKeyStatus.ACTIVATED);
        long totalCreditsIssued = ledgerRepo.sumTotalCreditsIssued();
        long auditEvents        = auditRepo.count();

        AdminStatsDto stats = new AdminStatsDto(
                totalUsers, activeTenants, activeLicenses,
                totalCreditsIssued, auditEvents
        );
        return ApiResponse.of(stats);
    }
}
