package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminRechargePackageUpsertDto;
import com.aistareco.aep.dto.RechargePackageDto;
import com.aistareco.aep.service.RechargePackageAdminService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 充值套餐 admin CRUD：/api/admin/finance/recharge-packages/*。v0.5 新增。
 * v2 §6：套餐定价属资金财务范畴 → 限 FINANCE_ADMIN / SUPER_ADMIN。
 */
@RestController
@RequestMapping("/api/admin/finance/recharge-packages")
@PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
public class AdminFinanceRechargePackageController {

    private final RechargePackageAdminService service;

    public AdminFinanceRechargePackageController(RechargePackageAdminService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<RechargePackageDto>> list() {
        return ApiResponse.of(service.listAll());
    }

    @GetMapping("/{id}")
    public ApiResponse<RechargePackageDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<RechargePackageDto> create(@RequestBody AdminRechargePackageUpsertDto req) {
        return ApiResponse.of(service.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<RechargePackageDto> update(@PathVariable String id,
                                                    @RequestBody AdminRechargePackageUpsertDto req) {
        return ApiResponse.of(service.update(id, req));
    }

    /** 软删：返回更新后的套餐（active=false）；ledger 保留引用。 */
    @DeleteMapping("/{id}")
    public ApiResponse<RechargePackageDto> delete(@PathVariable String id) {
        return ApiResponse.of(service.softDelete(id));
    }
}
