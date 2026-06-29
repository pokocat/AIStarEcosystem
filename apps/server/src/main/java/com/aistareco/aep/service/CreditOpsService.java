package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdjustmentResult;
import com.aistareco.aep.dto.CreditAdjustmentRequestDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.CreditAdjustmentRequest;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.repository.CreditAdjustmentRequestRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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

    /** 计入日限额的状态：已入账 + 待批（预占，防排队绕限）。 */
    private static final List<CreditAdjustmentRequest.Status> DAILY_COUNTED =
            List.of(CreditAdjustmentRequest.Status.APPROVED, CreditAdjustmentRequest.Status.PENDING_APPROVAL);

    /** 补偿幂等键：referenceType（同一工单只补一次）。 */
    private static final String REF_COMPENSATION = "ops_compensation";

    private final CreditService creditService;
    private final CreditAdjustmentRequestRepository requestRepo;
    private final LedgerEntryRepository ledgerRepo;
    private final long threshold;
    private final long actorDailyLimit;

    public CreditOpsService(CreditService creditService,
                            CreditAdjustmentRequestRepository requestRepo,
                            LedgerEntryRepository ledgerRepo,
                            @Value("${aep.credit.adjust.threshold-credits:5000}") long threshold,
                            @Value("${aep.credit.adjust.actor-daily-limit-credits:50000}") long actorDailyLimit) {
        this.creditService = creditService;
        this.requestRepo = requestRepo;
        this.ledgerRepo = ledgerRepo;
        this.threshold = threshold;
        this.actorDailyLimit = actorDailyLimit;
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
        enforceActorDailyLimit(operatorId, amount);
        if (amount > threshold) {
            CreditAdjustmentRequest req = createPending(
                    CreditAdjustmentRequest.Type.COMPENSATE, uid, amount, why, ticket, null, operatorId);
            return AdjustmentResult.pending(req.getId(), amount);
        }
        LedgerEntryDto e = doCompensate(uid, amount, ticket, why, operatorId);
        recordAutoApproved(CreditAdjustmentRequest.Type.COMPENSATE, uid, amount, why, ticket, null, operatorId, e.id());
        return AdjustmentResult.executed(e, amount);
    }

    /** 激励赠送：小额直发，大额落审批单。 */
    @Transactional
    public AdjustmentResult grantGift(String targetUserId, long amount, String campaignId,
                                      String reason, String operatorId) {
        String uid = requireText(targetUserId, "USER_ID_REQUIRED", "请选择用户");
        requirePositive(amount);
        String why = requireText(reason, "REASON_REQUIRED", "请填写赠送原因");
        String camp = (campaignId != null && !campaignId.isBlank()) ? campaignId.trim() : null;
        enforceActorDailyLimit(operatorId, amount);
        if (amount > threshold) {
            CreditAdjustmentRequest req = createPending(
                    CreditAdjustmentRequest.Type.GRANT, uid, amount, why, null, camp, operatorId);
            return AdjustmentResult.pending(req.getId(), amount);
        }
        LedgerEntryDto e = doGrant(uid, amount, camp, why, operatorId);
        recordAutoApproved(CreditAdjustmentRequest.Type.GRANT, uid, amount, why, null, camp, operatorId, e.id());
        return AdjustmentResult.executed(e, amount);
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

    /**
     * v2 §9.2 #5：发起人单日（滚动 24h）调差/赠送积分上限。已批 + 待批都计入（待批预占额度，
     * 防一次性排队多笔大额绕过限额）。{@code actorDailyLimit<=0} 或 operatorId 缺失 → 关闭（不限）。
     */
    private void enforceActorDailyLimit(String operatorId, long amount) {
        if (actorDailyLimit <= 0 || operatorId == null || operatorId.isBlank()) {
            return;
        }
        Instant since = Instant.now().minus(24, ChronoUnit.HOURS);
        long already = requestRepo.sumAmountByMakerSince(operatorId, since, DAILY_COUNTED);
        if (already + amount > actorDailyLimit) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "ACTOR_DAILY_LIMIT",
                    "超出本人单日调差/赠送上限（近 24h 已 " + already + " + 本次 " + amount
                            + " > 上限 " + actorDailyLimit + "）。请明日再发或交他人/拆分复核。");
        }
    }

    /**
     * 小额直发也落一条 APPROVED 审计单（§9.2 #4 不可变审计 + 计入日限额）。maker = 操作人、无独立 checker，
     * 已带 ledgerEntryId 可溯源；不进「待审批」队列（status=APPROVED）。
     */
    private void recordAutoApproved(CreditAdjustmentRequest.Type type, String uid, long amount, String reason,
                                    String incidentRef, String campaignId, String operatorId, String ledgerEntryId) {
        Instant now = Instant.now();
        CreditAdjustmentRequest req = CreditAdjustmentRequest.builder()
                .id("car-" + UUID.randomUUID().toString().substring(0, 12))
                .type(type).targetUserId(uid).amount(amount).reason(trim(reason, 512))
                .incidentRef(incidentRef).campaignId(campaignId)
                .status(CreditAdjustmentRequest.Status.APPROVED)
                .makerId(operatorId)
                .ledgerEntryId(ledgerEntryId)
                .decideNote("小额直发（≤阈值），单人即时")
                .createdAt(now).decidedAt(now)
                .build();
        requestRepo.save(req);
    }

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
        // 幂等（§14）：同一工单只补一次。choke-point 校验 → 小额直发 + 大额审批通过两条路径都覆盖，
        // 杜绝「重复提交 / 双审批通过」造成的双重补偿。
        if (ledgerRepo.existsByReferenceTypeAndReferenceId(REF_COMPENSATION, ticket)) {
            throw new BusinessException(HttpStatus.CONFLICT, "DUPLICATE_INCIDENT",
                    "该工单 " + ticket + " 已补偿过，请勿重复补偿（如需追加请用新工单号）");
        }
        String desc = "客诉补偿 " + amount + " 积分 · 工单 " + ticket + " · 原因：" + why + " · " + nz(operatorId);
        LedgerEntryDto entry = creditService.creditAccount(
                uid, amount, LedgerEntry.LedgerEntryType.GIFT, REF_COMPENSATION, ticket, desc);
        log.info("[credit-ops] compensate target={} amount={} ticket={} ledger={}", uid, amount, ticket, entry.id());
        return entry;
    }

    private LedgerEntryDto doGrant(String uid, long amount, String camp, String why, String operatorId) {
        String refType = camp != null ? "ops_gift_campaign:" + camp : "ops_gift";
        String refId = camp != null ? camp + ":" + uid : uid;
        // 幂等 fan-out（§9 批量 campaign）：同一活动同一用户只发一次。无活动号的临时赠送不设幂等（每次都是有意为之）。
        if (camp != null && ledgerRepo.existsByReferenceTypeAndReferenceId(refType, refId)) {
            throw new BusinessException(HttpStatus.CONFLICT, "DUPLICATE_CAMPAIGN_GRANT",
                    "用户在活动 " + camp + " 已发放过，幂等跳过（防重复发放）");
        }
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
