package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CreditPackDto;
import com.aistareco.aep.dto.CreditPurchaseDto;
import com.aistareco.aep.dto.RechargeRecordDto;
import com.aistareco.aep.repository.CreditPackRepository;
import com.aistareco.aep.repository.CreditPurchaseRepository;
import com.aistareco.aep.repository.RechargeRecordRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 用户侧设置视图：/api/settings/*（authenticated，见 AepSecurityConfig）。
 * 积分包全局共享；充值记录 / 购买记录只返回当前用户。
 *
 * 注意：本 controller 不再提供「购买积分包」写动作——v0.56 起充值统一走
 * RechargeService 订单 + 支付网关回调入账（CreditService 唯一记账入口）。
 * 历史上这里曾有 purchaseCreditPack() 直接绕过 CreditService 写 Wallet + Ledger，
 * 且 /api/settings/** 落入安全配置的 anyRequest().permitAll() 兜底，等价于任意
 * 登录用户零支付无限刷积分（例行 QA 2026-07-05 审计 F-01，与 CLAUDE.md §4.2
 * 「所有钱包余额变动必须经 LedgerEntry / CreditService」硬规则冲突）。前端三处
 * api/settings.ts 的 purchaseCreditPack() 已确认无任何 UI 入口调用（死代码），
 * 已随本次一并删除。
 */
@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final CreditPackRepository creditPackRepo;
    private final RechargeRecordRepository rechargeRecordRepo;
    private final CreditPurchaseRepository creditPurchaseRepo;

    public SettingsController(CreditPackRepository creditPackRepo,
                              RechargeRecordRepository rechargeRecordRepo,
                              CreditPurchaseRepository creditPurchaseRepo) {
        this.creditPackRepo = creditPackRepo;
        this.rechargeRecordRepo = rechargeRecordRepo;
        this.creditPurchaseRepo = creditPurchaseRepo;
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

    @GetMapping("/purchases")
    public ApiResponse<List<CreditPurchaseDto>> listPurchases(Principal principal) {
        return ApiResponse.of(creditPurchaseRepo
                .findByUserIdOrderByCreatedAtDesc(principal.getName())
                .stream().map(CreditPurchaseDto::from).toList());
    }
}
