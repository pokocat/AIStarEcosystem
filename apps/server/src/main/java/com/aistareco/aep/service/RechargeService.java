package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.RechargePackageDto;
import com.aistareco.aep.dto.RechargeResponseDto;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.model.RechargePackage;
import com.aistareco.aep.repository.RechargePackageRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * 充值服务（v0.4 新增）。负责套餐查询 + 落账。
 *
 * 落账流程：
 *   1) 主分录：creditAccount(userId, +credits, RECHARGE, ...)
 *   2) 如套餐含 bonus：creditAccount(userId, +bonus, GIFT, ...)
 *
 * mock：本期为同步直落账。线上接 wx.requestPayment 回调后调用此服务。
 */
@Service
public class RechargeService {

    private final RechargePackageRepository pkgRepo;
    private final CreditService creditService;

    public RechargeService(RechargePackageRepository pkgRepo, CreditService creditService) {
        this.pkgRepo = pkgRepo;
        this.creditService = creditService;
    }

    public List<RechargePackageDto> listPackages() {
        return pkgRepo.findByActiveTrueOrderBySortOrderAscCreditsAsc()
                .stream()
                .map(RechargePackageDto::from)
                .toList();
    }

    @Transactional
    public RechargeResponseDto recharge(String userId, String packageId) {
        RechargePackage pkg = pkgRepo.findById(packageId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "套餐不存在：" + packageId));
        if (!pkg.isActive()) {
            throw new ResponseStatusException(HttpStatus.GONE, "套餐已下架：" + packageId);
        }

        // 1) 主分录：充值进 recharge 桶
        LedgerEntryDto mainEntry = creditService.creditAccount(
                userId,
                pkg.getCredits(),
                LedgerEntry.LedgerEntryType.RECHARGE,
                "recharge_package",
                pkg.getId(),
                "充值套餐 " + pkg.getTag() + "（" + pkg.getCredits() + " 积分）"
        );

        // 2) 赠送（可选）：进 gift 桶
        if (pkg.getBonusCredits() > 0) {
            creditService.creditAccount(
                    userId,
                    pkg.getBonusCredits(),
                    LedgerEntry.LedgerEntryType.GIFT,
                    "recharge_package_bonus",
                    pkg.getId(),
                    "充值赠送 " + pkg.getBonusCredits() + " 积分（套餐 " + pkg.getTag() + "）"
            );
        }

        // 取最新 wallet 快照（包含 main + bonus 双分录的累计结果）
        WalletDto wallet = WalletDto.from(creditService.getOrCreateWallet(userId));
        return new RechargeResponseDto(wallet, mainEntry);
    }
}
