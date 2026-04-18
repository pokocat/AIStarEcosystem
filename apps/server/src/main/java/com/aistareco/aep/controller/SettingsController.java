package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CreditPackDto;
import com.aistareco.aep.dto.RechargeRecordDto;
import com.aistareco.aep.repository.CreditPackRepository;
import com.aistareco.aep.repository.RechargeRecordRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * 用户侧设置视图：/api/settings/*。
 * 积分包全局共享；充值记录只返回当前用户。
 */
@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final CreditPackRepository creditPackRepo;
    private final RechargeRecordRepository rechargeRecordRepo;

    public SettingsController(CreditPackRepository creditPackRepo,
                              RechargeRecordRepository rechargeRecordRepo) {
        this.creditPackRepo = creditPackRepo;
        this.rechargeRecordRepo = rechargeRecordRepo;
    }

    @GetMapping("/credit-packs")
    public ApiResponse<List<CreditPackDto>> creditPacks() {
        return ApiResponse.of(creditPackRepo.findAll(Sort.by("priceCents").ascending())
                .stream().map(CreditPackDto::from).toList());
    }

    @GetMapping("/recharge-history")
    public ApiResponse<List<RechargeRecordDto>> rechargeHistory(Principal principal) {
        return ApiResponse.of(rechargeRecordRepo
                .findByUserIdOrderByRecordDateDesc(principal.getName())
                .stream().map(RechargeRecordDto::from).toList());
    }
}
