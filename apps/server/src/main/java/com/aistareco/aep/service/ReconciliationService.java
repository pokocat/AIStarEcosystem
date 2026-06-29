package com.aistareco.aep.service;

import com.aistareco.aep.dto.ReconciliationReportDto;
import com.aistareco.aep.model.LedgerEntry.LedgerEntryType;
import com.aistareco.aep.model.RechargeOrder;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.repository.RechargeOrderRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/**
 * 对账与不变量（v2 §11）。从不可变账本 + 充值订单重算资金/积分两平面，断言现金勾稽，
 * 把积分负债单列。<b>只读、只算、只报</b> —— drift 仅告警不自动消解（守 §8.0）。
 *
 * 影子单（paidVia=shadow，非真实现金）从现金勾稽剔除（§6.7）；生产真实渠道时无影子单。
 */
@Service
public class ReconciliationService {

    /** 曾入账过的订单状态：退款只改状态、不删 RECHARGE 账本分录，故 PAID+REFUNDED 都算现金事实。 */
    private static final List<RechargeOrder.Status> ISSUED =
            List.of(RechargeOrder.Status.PAID, RechargeOrder.Status.REFUNDED);
    private static final String SHADOW = "shadow";

    private final LedgerEntryRepository ledgerRepo;
    private final RechargeOrderRepository orderRepo;

    public ReconciliationService(LedgerEntryRepository ledgerRepo, RechargeOrderRepository orderRepo) {
        this.ledgerRepo = ledgerRepo;
        this.orderRepo = orderRepo;
    }

    public ReconciliationReportDto compute() {
        // 资金面（订单侧，非影子）
        long grossRecharge = orderRepo.sumCreditsByStatusesExcludingPaidVia(ISSUED, SHADOW);
        long refundedReclaimed = orderRepo.sumRefundedCreditsExcludingPaidVia(SHADOW);
        long withdrawn = -ledgerRepo.sumAmountByType(LedgerEntryType.WITHDRAW); // 账本 WITHDRAW 为负 → 取正
        long netCashCredits = grossRecharge - refundedReclaimed - withdrawn;

        // 勾稽：账本 RECHARGE（剔除影子）vs 订单侧现金事实
        long shadowRecharge = orderRepo.sumCreditsByStatusesAndPaidVia(ISSUED, SHADOW);
        long ledgerRechargeNonShadow = ledgerRepo.sumAmountByType(LedgerEntryType.RECHARGE) - shadowRecharge;
        long drift = grossRecharge - ledgerRechargeNonShadow;

        // 积分面负债（单列，永不进现金/营收）
        long giftIssued = ledgerRepo.sumAmountByType(LedgerEntryType.GIFT);
        long adjustNet = ledgerRepo.sumAmountByType(LedgerEntryType.ADJUST);
        long licenseGranted = ledgerRepo.sumAmountByType(LedgerEntryType.LICENSE_GRANT);
        long creditLiability = giftIssued + adjustNet + licenseGranted;

        return new ReconciliationReportDto(
                grossRecharge, refundedReclaimed, withdrawn, netCashCredits,
                ledgerRechargeNonShadow, drift, drift == 0,
                shadowRecharge,
                giftIssued, adjustNet, licenseGranted, creditLiability,
                Instant.now());
    }
}
