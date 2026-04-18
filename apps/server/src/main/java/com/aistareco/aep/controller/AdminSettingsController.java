package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CreditPackDto;
import com.aistareco.aep.dto.RechargeRecordDto;
import com.aistareco.aep.repository.CreditPackRepository;
import com.aistareco.aep.repository.RechargeRecordRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/settings")
public class AdminSettingsController {

    private final CreditPackRepository creditPackRepo;
    private final RechargeRecordRepository rechargeRecordRepo;

    public AdminSettingsController(CreditPackRepository creditPackRepo,
                                    RechargeRecordRepository rechargeRecordRepo) {
        this.creditPackRepo = creditPackRepo;
        this.rechargeRecordRepo = rechargeRecordRepo;
    }

    @GetMapping("/credit-packs")
    public ApiResponse<List<CreditPackDto>> creditPacks() {
        List<CreditPackDto> list = creditPackRepo.findAll().stream()
                .map(CreditPackDto::from).toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/recharge-history")
    public ApiResponse<List<RechargeRecordDto>> rechargeHistory() {
        List<RechargeRecordDto> list = rechargeRecordRepo.findAll().stream()
                .map(RechargeRecordDto::from).toList();
        return ApiResponse.of(list);
    }
}
