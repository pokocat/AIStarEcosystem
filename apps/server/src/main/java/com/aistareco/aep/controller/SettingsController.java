package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CreditPackDto;
import com.aistareco.aep.dto.CreditPurchaseDto;
import com.aistareco.aep.dto.RechargeRecordDto;
import com.aistareco.aep.model.CreditPack;
import com.aistareco.aep.model.CreditPurchase;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.CreditPackRepository;
import com.aistareco.aep.repository.CreditPurchaseRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.RechargeRecordRepository;
import com.aistareco.aep.repository.WalletRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 用户侧设置视图：/api/settings/*。
 * 积分包全局共享；充值记录只返回当前用户。
 */
@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final CreditPackRepository creditPackRepo;
    private final RechargeRecordRepository rechargeRecordRepo;
    private final CreditPurchaseRepository creditPurchaseRepo;
    private final WalletRepository walletRepo;
    private final LedgerEntryRepository ledgerRepo;

    public SettingsController(CreditPackRepository creditPackRepo,
                              RechargeRecordRepository rechargeRecordRepo,
                              CreditPurchaseRepository creditPurchaseRepo,
                              WalletRepository walletRepo,
                              LedgerEntryRepository ledgerRepo) {
        this.creditPackRepo = creditPackRepo;
        this.rechargeRecordRepo = rechargeRecordRepo;
        this.creditPurchaseRepo = creditPurchaseRepo;
        this.walletRepo = walletRepo;
        this.ledgerRepo = ledgerRepo;
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

    /**
     * 购买积分包。一次原子事务内完成：
     * 1) 插入 CreditPurchase（订单凭证）
     * 2) 追加 LedgerEntry(RECHARGE) 流水
     * 3) 更新 Wallet.totalBalance + rechargeBalance
     */
    @PostMapping("/credit-packs/{packId}/purchase")
    @Transactional
    public ApiResponse<CreditPurchaseDto> purchaseCreditPack(Principal principal,
                                                              @PathVariable String packId,
                                                              @RequestBody(required = false) Map<String, Object> body) {
        CreditPack pack = creditPackRepo.findById(packId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "积分包不存在: " + packId));
        if (pack.getStatus() != CreditPack.CreditPackStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "积分包已下架");
        }

        String userId = principal.getName();
        Wallet wallet = walletRepo.findByUserId(userId)
                .orElseGet(() -> {
                    Wallet w = Wallet.builder()
                            .id(UUID.randomUUID().toString())
                            .userId(userId)
                            .createdAt(Instant.now())
                            .build();
                    return walletRepo.save(w);
                });

        Instant now = Instant.now();
        long newBalance = wallet.getTotalBalance() + pack.getCredits();
        wallet.setTotalBalance(newBalance);
        wallet.setRechargeBalance(wallet.getRechargeBalance() + pack.getCredits());
        wallet.setUpdatedAt(now);
        walletRepo.save(wallet);

        LedgerEntry ledger = LedgerEntry.builder()
                .id(UUID.randomUUID().toString())
                .walletId(wallet.getId())
                .userId(userId)
                .entryType(LedgerEntry.LedgerEntryType.RECHARGE)
                .amount(pack.getCredits())
                .balanceAfter(newBalance)
                .description("购买积分包：" + pack.getName())
                .referenceId(packId)
                .referenceType("credit_pack")
                .createdAt(now)
                .build();
        ledgerRepo.save(ledger);

        CreditPurchase purchase = CreditPurchase.builder()
                .id(UUID.randomUUID().toString())
                .userId(userId)
                .packId(packId)
                .priceCents(pack.getPriceCents())
                .creditsAdded(pack.getCredits())
                .createdAt(now)
                .paymentMetaJson(body == null ? null : new java.util.LinkedHashMap<>(body))
                .build();
        creditPurchaseRepo.save(purchase);

        return ApiResponse.of(CreditPurchaseDto.from(purchase));
    }

    @GetMapping("/purchases")
    public ApiResponse<List<CreditPurchaseDto>> listPurchases(Principal principal) {
        return ApiResponse.of(creditPurchaseRepo
                .findByUserIdOrderByCreatedAtDesc(principal.getName())
                .stream().map(CreditPurchaseDto::from).toList());
    }
}
