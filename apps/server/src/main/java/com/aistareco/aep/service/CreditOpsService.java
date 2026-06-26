package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdjustmentResult;
import com.aistareco.aep.dto.CreditAdjustmentRequestDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.CreditAdjustmentRequest;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.repository.CreditAdjustmentRequestRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * 运营调差 / 赠送（v2 §5 / §9 积分面 lane）+ maker-checker（§9.2）。
 *
 * 两个动作都只往 {@code giftBalance} 加正积分（经 {@link CreditService#creditAccount} 的 GIFT 分支），
 * 物理上够不到资金面 —— 即「调差 / 赠送不碰真实资金」的结构性保证。
 *
 * maker-checker：小额（≤ 阈值 {@code aep.credit.adjust.threshold-credits}，默认 5000）由 OPERATOR 单人
 * 直接发放；大额（&gt; 阈值）先落 PENDING_APPROVAL 审批单（**不入账**），需第二个不同身份的
 * FINANCE_ADMIN / SUPER_ADMIN 复核（maker != checker 服务端硬校验）批准后才入账。
 *
 * 后续（非本阶段）：批量 campaign 幂等 + 独立 AdminAuditLog。
 */
@Service
public class CreditOpsService {

    private static final Logger log = LoggerFactory.getLogger(CreditOpsService.class);

    private final CreditService creditService;
    private final CreditAdjustmentRequestRepository requestRepo;
    private final long threshold;

    public CreditOpsService(CreditService creditService,
                            CreditAdjustmentRequestRepository requestRepo,
                            @Value("${aep.credit.adjust.threshold-credits:5000}") long threshold) {
        this.creditService = creditService;
        this.requestRepo = requestRepo;
        this.threshold = threshold;
    }

    // ── 发起（maker） ────────────────────────────────────────────────

    /** 客诉补偿：小额直发，大额落审批单。 */
    @Transactional
    public AdjustmentResult compensate(String targetUserId, long amount, String incidentRef,
                                       String reason, String operatorId) {
        String uid = requireText(targetUserId, "USER_ID_REQUIRED", "请选择用户");
        requirePositive(amount);
        String ticket = requireText(incidentRef, "INCIDENT_REF_REQUIRED", "请填写工单号 / 事故单号");
        String why = requireText(reason, "REASON_REQUIRED", "请填写补偿原因");
        if (amount > threshold) {
            CreditAdjustmentRequest req = createPending(
                    CreditAdjustmentRequest.Type.COMPENSATE, uid, amount, why, ticket, null, operatorId);
            return AdjustmentResult.pending(req.getId(), amount);
        }
        return AdjustmentResult.executed(doCompensate(uid, amount, ticket, why, operatorId), amount);
    }

    /** 激励赠送：小额直发，大额落审批单。 */
    @Transactional
    public AdjustmentResult grantGift(String targetUserId, long amount, String campaignId,
                                      String reason, String operatorId) {
        String uid = requireText(targetUserId, "USER_ID_REQUIRED", "请选择用户");
        requirePositive(amount);
        String why = requireText(reason, "REASON_REQUIRED", "请填写赠送原因");
        String camp = (campaignId != null && !campaignId.isBlank()) ? campaignId.trim() : null;
        if (amount > threshold) {
            CreditAdjustmentRequest req = createPending(
                    CreditAdjustmentRequest.Type.GRANT, uid, amount, why, null, camp, operatorId);
            return AdjustmentResult.pending(req.getId(), amount);
        }
        return AdjustmentResult.executed(doGrant(uid, amount, camp, why, operatorId), amount);
    }

    // ── 复核（checker：FINANCE_ADMIN / SUPER_ADMIN，controller @PreAuthorize 门禁） ──

    public List<CreditAdjustmentRequestDto> listRequests(String status) {
        List<CreditAdjustmentRequest> rows;
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) {
            CreditAdjustmentRequest.Status s;
            try {
                s = CreditAdjustmentRequest.Status.valueOf(status.trim().toUpperCase(Locale.ROOT));
            } catch (IllegalArgumentException ex) {
                throw BusinessException.badRequest("INVALID_STATUS", "非法状态：" + status);
            }
            rows = requestRepo.findByStatusOrderByCreatedAtDesc(s);
        } else {
            rows = requestRepo.findAllByOrderByCreatedAtDesc();
        }
        return rows.stream().map(CreditAdjustmentRequestDto::from).toList();
    }

    /** 批准：maker != checker 硬校验 → 真正入账（GIFT）。 */
    @Transactional
    public CreditAdjustmentRequestDto approve(String requestId, String checkerId) {
        CreditAdjustmentRequest req = requirePending(requestId);
        if (req.getMakerId() != null && req.getMakerId().equals(checkerId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "MAKER_CHECKER_SAME", "复核人不能是发起人");
        }
        String actor = "审批通过 · 复核 " + nz(checkerId) + " · 发起 " + nz(req.getMakerId());
        LedgerEntryDto e = req.getType() == CreditAdjustmentRequest.Type.COMPENSATE
                ? doCompensate(req.getTargetUserId(), req.getAmount(), req.getIncidentRef(), req.getReason(), actor)
                : doGrant(req.getTargetUserId(), req.getAmount(), req.getCampaignId(), req.getReason(), actor);
        req.setStatus(CreditAdjustmentRequest.Status.APPROVED);
        req.setCheckerId(checkerId);
        req.setLedgerEntryId(e.id());
        req.setDecidedAt(Instant.now());
        requestRepo.save(req);
        log.info("[credit-ops] approved request={} maker={} checker={} ledger={}",
                requestId, req.getMakerId(), checkerId, e.id());
        return CreditAdjustmentRequestDto.from(req);
    }

    /** 驳回。 */
    @Transactional
    public CreditAdjustmentRequestDto reject(String requestId, String checkerId, String note) {
        CreditAdjustmentRequest req = requirePending(requestId);
        req.setStatus(CreditAdjustmentRequest.Status.REJECTED);
        req.setCheckerId(checkerId);
        req.setDecideNote(trim(note, 512));
        req.setDecidedAt(Instant.now());
        requestRepo.save(req);
        log.info("[credit-ops] rejected request={} checker={}", requestId, checkerId);
        return CreditAdjustmentRequestDto.from(req);
    }

    // ── 内部 ────────────────────────────────────────────────────────

    private CreditAdjustmentRequest createPending(CreditAdjustmentRequest.Type type, String uid, long amount,
                                                  String reason, String incidentRef, String campaignId, String operatorId) {
        CreditAdjustmentRequest req = CreditAdjustmentRequest.builder()
                .id("car-" + UUID.randomUUID().toString().substring(0, 12))
                .type(type).targetUserId(uid).amount(amount).reason(trim(reason, 512))
                .incidentRef(incidentRef).campaignId(campaignId)
                .status(CreditAdjustmentRequest.Status.PENDING_APPROVAL)
                .makerId(operatorId)
                .createdAt(Instant.now())
                .build();
        requestRepo.save(req);
        log.info("[credit-ops] pending approval request={} type={} target={} amount={} maker={}",
                req.getId(), type, uid, amount, operatorId);
        return req;
    }

    private CreditAdjustmentRequest requirePending(String requestId) {
        CreditAdjustmentRequest req = requestRepo.findById(requestId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "REQUEST_NOT_FOUND", "审批单不存在"));
        if (req.getStatus() != CreditAdjustmentRequest.Status.PENDING_APPROVAL) {
            throw new BusinessException(HttpStatus.CONFLICT, "REQUEST_NOT_PENDING",
                    "该审批单已处理（" + req.getStatus() + "）");
        }
        return req;
    }

    private LedgerEntryDto doCompensate(String uid, long amount, String ticket, String why, String operatorId) {
        String desc = "客诉补偿 " + amount + " 积分 · 工单 " + ticket + " · 原因：" + why + " · " + nz(operatorId);
        LedgerEntryDto entry = creditService.creditAccount(
                uid, amount, LedgerEntry.LedgerEntryType.GIFT, "ops_compensation", ticket, desc);
        log.info("[credit-ops] compensate target={} amount={} ticket={} ledger={}", uid, amount, ticket, entry.id());
        return entry;
    }

    private LedgerEntryDto doGrant(String uid, long amount, String camp, String why, String operatorId) {
        String refType = camp != null ? "ops_gift_campaign:" + camp : "ops_gift";
        String refId = camp != null ? camp + ":" + uid : uid;
        String desc = "运营赠送 " + amount + " 积分" + (camp != null ? "（活动 " + camp + "）" : "")
                + " · 原因：" + why + " · " + nz(operatorId);
        LedgerEntryDto entry = creditService.creditAccount(
                uid, amount, LedgerEntry.LedgerEntryType.GIFT, refType, refId, desc);
        log.info("[credit-ops] grantGift target={} amount={} campaign={} ledger={}", uid, amount, camp, entry.id());
        return entry;
    }

    private static void requirePositive(long amount) {
        if (amount <= 0) throw BusinessException.badRequest("AMOUNT_POSITIVE", "积分数必须为正数");
    }

    private static String requireText(String s, String code, String msg) {
        if (s == null || s.isBlank()) throw BusinessException.badRequest(code, msg);
        return s.trim();
    }

    private static String trim(String s, int max) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static String nz(String s) {
        return s == null ? "（未知）" : s;
    }
}
