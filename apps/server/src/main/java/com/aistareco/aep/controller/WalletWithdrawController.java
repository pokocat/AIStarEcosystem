package com.aistareco.aep.controller;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.TransactionDto;
import com.aistareco.aep.dto.WithdrawalRequestDto;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.UUID;

/**
 * 钱包提现（v0.45 drama 财务中心）：POST /api/me/wallet/withdraw。
 *
 * 独立小 controller，避免改动 {@link AccountController} 庞大的构造器。
 * 与 AccountController 同前缀 /api/me/wallet，但路径 / 方法不重叠（AccountController 只有
 * GET /wallet、/wallet/credits、/wallet/packages 与 POST /wallet/recharge）。
 *
 * 提现必须经 {@link CreditService#withdraw} 写 WITHDRAW LedgerEntry（积分账本不可变约束）。
 */
@RestController
@RequestMapping("/api/me/wallet")
public class WalletWithdrawController {

    private final CreditService creditService;

    public WalletWithdrawController(CreditService creditService) {
        this.creditService = creditService;
    }

    @PostMapping("/withdraw")
    public ApiResponse<TransactionDto> withdraw(Principal principal, @RequestBody WithdrawalRequestDto req) {
        if (req == null || req.amount() <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "提现金额必须为正数");
        }
        String card = req.bankCard() == null ? "" : req.bankCard().trim();
        String masked = card.length() >= 4 ? "尾号 " + card.substring(card.length() - 4) : card;
        String source = masked.isBlank() ? "提现" : "提现到银行卡 " + masked;
        LedgerEntryDto entry = creditService.withdraw(
                principal.getName(), req.amount(), "wallet_withdraw",
                UUID.randomUUID().toString(), source);
        return ApiResponse.of(new TransactionDto(
                entry.id(),
                source,
                entry.amount(),
                entry.createdAt() != null ? entry.createdAt().toString().substring(0, 10) : "",
                "processing",
                "withdrawal",
                principal.getName()));
    }
}
