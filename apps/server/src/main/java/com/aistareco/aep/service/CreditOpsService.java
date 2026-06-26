package com.aistareco.aep.service;

import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 运营调差 / 赠送（v2 §5 / §9 积分面 lane）。
 *
 * 两个动作都只往 {@code giftBalance} 加正积分（经 {@link CreditService#creditAccount} 的 GIFT 分支），
 * 物理上够不到资金面（rechargeBalance / 提现 / 退款）—— 这就是「调差 / 赠送不碰真实资金」的结构性保证：
 * 本类不注入任何支付网关，也只会调 GIFT 入账。
 *
 * 强制填原因；客诉补偿强制填工单号。审计信息（操作人 / 原因 / 工单）写进不可变 {@link LedgerEntry} 的
 * description + referenceType/referenceId，可在结算中心账本溯源。
 *
 * 后续层（v2 §9.1 / §9.2，非本阶段）：maker-checker 双签 + 批量 campaign 幂等 + 独立 AdminAuditLog +
 * 角色拆分（PLATFORM_OPERATOR 提交 / FINANCE_ADMIN 大额复核）。
 */
@Service
public class CreditOpsService {

    private static final Logger log = LoggerFactory.getLogger(CreditOpsService.class);

    private final CreditService creditService;

    public CreditOpsService(CreditService creditService) {
        this.creditService = creditService;
    }

    /** 客诉补偿：给用户补发赠送积分（落 giftBalance），挂工单号溯源。amount &gt; 0。 */
    @Transactional
    public LedgerEntryDto compensate(String targetUserId, long amount, String incidentRef,
                                     String reason, String operatorId) {
        String uid = requireText(targetUserId, "USER_ID_REQUIRED", "请选择用户");
        requirePositive(amount);
        String ticket = requireText(incidentRef, "INCIDENT_REF_REQUIRED", "请填写工单号 / 事故单号");
        String why = requireText(reason, "REASON_REQUIRED", "请填写补偿原因");
        String desc = "客诉补偿 " + amount + " 积分 · 工单 " + ticket + " · 原因：" + why
                + " · 操作人 " + nz(operatorId);
        LedgerEntryDto entry = creditService.creditAccount(
                uid, amount, LedgerEntry.LedgerEntryType.GIFT, "ops_compensation", ticket, desc);
        log.info("[credit-ops] compensate target={} amount={} ticket={} operator={} ledger={}",
                uid, amount, ticket, operatorId, entry.id());
        return entry;
    }

    /** 激励赠送：给用户发赠送积分（落 giftBalance），可挂活动号。amount &gt; 0。 */
    @Transactional
    public LedgerEntryDto grantGift(String targetUserId, long amount, String campaignId,
                                    String reason, String operatorId) {
        String uid = requireText(targetUserId, "USER_ID_REQUIRED", "请选择用户");
        requirePositive(amount);
        String why = requireText(reason, "REASON_REQUIRED", "请填写赠送原因");
        boolean hasCampaign = campaignId != null && !campaignId.isBlank();
        String camp = hasCampaign ? campaignId.trim() : null;
        String refType = camp != null ? "ops_gift_campaign:" + camp : "ops_gift";
        String refId = camp != null ? camp + ":" + uid : uid;
        String desc = "运营赠送 " + amount + " 积分" + (camp != null ? "（活动 " + camp + "）" : "")
                + " · 原因：" + why + " · 操作人 " + nz(operatorId);
        LedgerEntryDto entry = creditService.creditAccount(
                uid, amount, LedgerEntry.LedgerEntryType.GIFT, refType, refId, desc);
        log.info("[credit-ops] grantGift target={} amount={} campaign={} operator={} ledger={}",
                uid, amount, camp, operatorId, entry.id());
        return entry;
    }

    private static void requirePositive(long amount) {
        if (amount <= 0) {
            throw BusinessException.badRequest("AMOUNT_POSITIVE", "积分数必须为正数");
        }
    }

    private static String requireText(String s, String code, String msg) {
        if (s == null || s.isBlank()) {
            throw BusinessException.badRequest(code, msg);
        }
        return s.trim();
    }

    private static String nz(String s) {
        return s == null ? "（未知）" : s;
    }
}
