package com.aistareco.aep.service;

import com.aistareco.aep.dto.AdjustmentResult;
import com.aistareco.aep.dto.CreditAdjustmentRequestDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.model.CreditAdjustmentRequest;
import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.model.LedgerEntry;
import com.aistareco.aep.repository.CreditAdjustmentRequestRepository;
import com.aistareco.aep.repository.AdminUserRepository;
import com.aistareco.aep.repository.LedgerEntryRepository;
import com.aistareco.aep.billing.service.ScopedCreditService;
import com.aistareco.aep.billing.service.ModelBillingMath;
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
 * 普通补偿/赠送进入 {@code giftBalance}；模型赠款单独进入 CreditGrant，均不改充值余额。
 *
 * maker-checker：小额（≤ 阈值 {@code aep.credit.adjust.threshold-credits}，默认 5000）由 OPERATOR 单人
 * 直接发放；大额（&gt; 阈值）先落 PENDING_APPROVAL 审批单（**不入账**），需第二个不同身份的
 * FINANCE_ADMIN / SUPER_ADMIN 复核后才入账。当前有效 SUPER_ADMIN 可直接发放，并可批准本人历史待审单；
 * 其他角色仍校验 maker != checker。原因、日限额、GIFT 桶与审计保持一致。
 *
 * 模型赠款的请求编号同时覆盖待审批和直发重试；全量审批单记录发起、复核及账本来源。
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
    private final AdminUserRepository admins;
    private final ScopedCreditService scopedCredits;
    private final long threshold;
    private final long actorDailyLimit;

    public CreditOpsService(CreditService creditService,
                            CreditAdjustmentRequestRepository requestRepo,
                            LedgerEntryRepository ledgerRepo,
                            AdminUserRepository admins,
                            ScopedCreditService scopedCredits,
                            @Value("${aep.credit.adjust.threshold-credits:5000}") long threshold,
                            @Value("${aep.credit.adjust.actor-daily-limit-credits:50000}") long actorDailyLimit) {
        this.creditService = creditService;
        this.requestRepo = requestRepo;
        this.ledgerRepo = ledgerRepo;
        this.admins = admins;
        this.scopedCredits = scopedCredits;
        this.threshold = threshold;
        this.actorDailyLimit = actorDailyLimit;
    }

    // ── 发起（maker） ────────────────────────────────────────────────

    /** 客诉补偿：超管直发，其他角色大额落审批单。 */
    @Transactional
    public AdjustmentResult compensate(String targetUserId, long amount, String incidentRef,
                                       String reason, String operatorId) {
        String uid = requireText(targetUserId, "USER_ID_REQUIRED", "请选择用户");
        requirePositive(amount);
        String ticket = requireText(incidentRef, "INCIDENT_REF_REQUIRED", "请填写工单号 / 事故单号");
        String why = requireText(reason, "REASON_REQUIRED", "请填写补偿原因");
        enforceActorDailyLimit(operatorId, amount);
        boolean directSuperAdmin = isActiveSuperAdmin(operatorId);
        if (amount > threshold && !directSuperAdmin) {
            CreditAdjustmentRequest req = createPending(
                    CreditAdjustmentRequest.Type.COMPENSATE, uid, amount, why, ticket, null, operatorId);
            return AdjustmentResult.pending(req.getId(), amount);
        }
        LedgerEntryDto e = doCompensate(uid, amount, ticket, why, operatorId);
        recordAutoApproved(CreditAdjustmentRequest.Type.COMPENSATE, uid, amount, why, ticket, null, operatorId, e.id(), directSuperAdmin);
        return AdjustmentResult.executed(e, amount);
    }

    /** 激励赠送：超管直发，其他角色大额落审批单。 */
    @Transactional
    public AdjustmentResult grantGift(String targetUserId, long amount, String campaignId,
                                      String reason, String operatorId) {
        String uid = requireText(targetUserId, "USER_ID_REQUIRED", "请选择用户");
        requirePositive(amount);
        String why = requireText(reason, "REASON_REQUIRED", "请填写赠送原因");
        String camp = (campaignId != null && !campaignId.isBlank()) ? campaignId.trim() : null;
        enforceActorDailyLimit(operatorId, amount);
        boolean directSuperAdmin = isActiveSuperAdmin(operatorId);
        if (amount > threshold && !directSuperAdmin) {
            CreditAdjustmentRequest req = createPending(
                    CreditAdjustmentRequest.Type.GRANT, uid, amount, why, null, camp, operatorId);
            return AdjustmentResult.pending(req.getId(), amount);
        }
        LedgerEntryDto e = doGrant(uid, amount, camp, why, operatorId);
        recordAutoApproved(CreditAdjustmentRequest.Type.GRANT, uid, amount, why, null, camp, operatorId, e.id(), directSuperAdmin);
        return AdjustmentResult.executed(e, amount);
    }

    // ── 复核（checker：FINANCE_ADMIN / SUPER_ADMIN，controller @PreAuthorize 门禁） ──

    /** Restricted grants share approval/day limits but never enter the ordinary gift bucket. */
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public CreditAdjustmentRequestDto grantScoped(String walletId,String campaignId,long amount,Instant expiresAt,
                                                  String clientRequestId,String reason,String operatorId) {
        String actor=requireText(operatorId,"ACTOR_REQUIRED","请登录后台后操作");
        String wallet=requireBounded(walletId,255,"请选择消费账户");
        String campaign=requireBounded(campaignId,64,"请选择赠款活动");
        String request=requireBounded(clientRequestId,128,"请提供发放请求编号");
        String why=requireBounded(reason,512,"请填写赠送原因");
        if(amount<=0 || amount>ModelBillingMath.MAX_CREDITS || expiresAt==null)
            throw BusinessException.badRequest("SCOPED_GRANT_INVALID","请填写有效的赠送额度和有效期");
        Instant expiry=expiresAt.truncatedTo(ChronoUnit.MICROS);
        var staff=admins.lockById(actor).orElseThrow(()->new BusinessException(HttpStatus.FORBIDDEN,"ADMIN_INACTIVE","管理员不可用"));
        if(staff.getStatus()!=AdminUser.AdminStatus.ACTIVE)
            throw new BusinessException(HttpStatus.FORBIDDEN,"ADMIN_INACTIVE","管理员不可用");
        // Actor-scoped deterministic key protects both direct issuance and pending requests on retry.
        String id="csg-"+UUID.nameUUIDFromBytes((actor.length()+":"+actor+request).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        var existing=requestRepo.lockById(id).orElse(null);
        if(existing!=null) {
            if(existing.getType()!=CreditAdjustmentRequest.Type.SCOPED_GRANT
                    || !wallet.equals(existing.getWalletId()) || !campaign.equals(existing.getCampaignId())
                    || amount!=existing.getAmount() || !expiry.equals(existing.getExpiresAt())
                    || !why.equals(existing.getReason()) || !actor.equals(existing.getMakerId()))
                throw new BusinessException(HttpStatus.CONFLICT,"SCOPED_GRANT_REPLAY_MISMATCH","这次发放编号已用于其他内容");
            return CreditAdjustmentRequestDto.from(existing);
        }
        enforceActorDailyLimit(actor,amount);
        var destination=scopedCredits.validateGrant(wallet,campaign,amount,expiry);
        boolean directSuperAdmin=staff.getRole()==AdminUser.AdminRole.SUPER_ADMIN;
        var row=CreditAdjustmentRequest.builder().id(id).type(CreditAdjustmentRequest.Type.SCOPED_GRANT)
                .targetUserId("personal".equals(destination.getAccountType())?destination.getUserId():destination.getMemberUserId())
                .walletId(wallet).campaignId(campaign).amount(amount).expiresAt(expiry).reason(why)
                .makerId(actor).createdAt(Instant.now()).status(CreditAdjustmentRequest.Status.PENDING_APPROVAL).build();
        requestRepo.save(row);
        if(amount<=threshold || directSuperAdmin) {
            doScopedGrant(row,actor);
            row.setStatus(CreditAdjustmentRequest.Status.APPROVED);row.setDecidedAt(Instant.now());
            row.setDecideNote(directSuperAdmin?"超管直接发放，无需独立复核":"小额直发（≤阈值），单人即时");
            requestRepo.save(row);
        }
        return CreditAdjustmentRequestDto.from(row);
    }

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

    /** 批准：仅当前有效超管可自批；锁原单，避免并发批准重复入账。 */
    @Transactional(isolation=org.springframework.transaction.annotation.Isolation.READ_COMMITTED)
    public CreditAdjustmentRequestDto approve(String requestId, String checkerId) {
        CreditAdjustmentRequest req = requirePending(requestId);
        boolean superAdmin = isActiveSuperAdmin(checkerId);
        if (!superAdmin && req.getMakerId() != null && req.getMakerId().equals(checkerId)) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "MAKER_CHECKER_SAME", "复核人不能是发起人");
        }
        String actor = (superAdmin ? "超管批准入账" : "审批通过") + " · 复核 " + nz(checkerId) + " · 发起 " + nz(req.getMakerId());
        if(req.getType()==CreditAdjustmentRequest.Type.SCOPED_GRANT) {
            doScopedGrant(req,checkerId);
        } else {
            LedgerEntryDto e = req.getType() == CreditAdjustmentRequest.Type.COMPENSATE
                    ? doCompensate(req.getTargetUserId(), req.getAmount(), req.getIncidentRef(), req.getReason(), actor)
                    : doGrant(req.getTargetUserId(), req.getAmount(), req.getCampaignId(), req.getReason(), actor);
            req.setLedgerEntryId(e.id());
        }
        req.setStatus(CreditAdjustmentRequest.Status.APPROVED);
        req.setCheckerId(checkerId);
        if (superAdmin) req.setDecideNote("超管批准入账（允许本人发起）");
        req.setDecidedAt(Instant.now());
        requestRepo.save(req);
        log.info("[credit-ops] approved request={} maker={} checker={} ledger={}",
                requestId, req.getMakerId(), checkerId, req.getLedgerEntryId());
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
        // Serialize requests by maker; use a locking current read under MySQL REPEATABLE READ.
        admins.lockById(operatorId);
        long already = requestRepo.lockByMakerSince(operatorId, since, DAILY_COUNTED).stream()
                .mapToLong(CreditAdjustmentRequest::getAmount).reduce(0,Math::addExact);
        if (amount > actorDailyLimit || already > actorDailyLimit - amount) {
            throw new BusinessException(HttpStatus.TOO_MANY_REQUESTS, "ACTOR_DAILY_LIMIT",
                    "超出本人单日调差/赠送上限（近 24h 已 " + already + " + 本次 " + amount
                            + " > 上限 " + actorDailyLimit + "）。请明日再发或交他人/拆分复核。");
        }
    }

    /**
     * 所有直发均落 APPROVED 审计单（§9.2 #4 不可变审计 + 计入日限额）。maker = 操作人、无独立 checker，
     * 已带 ledgerEntryId 可溯源；不进「待审批」队列（status=APPROVED）。
     */
    private void recordAutoApproved(CreditAdjustmentRequest.Type type, String uid, long amount, String reason,
                                    String incidentRef, String campaignId, String operatorId, String ledgerEntryId, boolean directSuperAdmin) {
        Instant now = Instant.now();
        CreditAdjustmentRequest req = CreditAdjustmentRequest.builder()
                .id("car-" + UUID.randomUUID().toString().substring(0, 12))
                .type(type).targetUserId(uid).amount(amount).reason(trim(reason, 512))
                .incidentRef(incidentRef).campaignId(campaignId)
                .status(CreditAdjustmentRequest.Status.APPROVED)
                .makerId(operatorId)
                .ledgerEntryId(ledgerEntryId)
                .decideNote(directSuperAdmin ? "超管直接发放，无需独立复核" : "小额直发（≤阈值），单人即时")
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
        CreditAdjustmentRequest req = requestRepo.lockById(requestId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "REQUEST_NOT_FOUND", "审批单不存在"));
        if (req.getStatus() != CreditAdjustmentRequest.Status.PENDING_APPROVAL) {
            throw new BusinessException(HttpStatus.CONFLICT, "REQUEST_NOT_PENDING",
                    "该审批单已处理（" + req.getStatus() + "）");
        }
        return req;
    }

    /** Exception comes from the current staff record, never from request body or a caller-supplied flag. */
    private boolean isActiveSuperAdmin(String actorId) {
        return actorId != null && admins.findById(actorId)
                .filter(a -> a.getStatus() == AdminUser.AdminStatus.ACTIVE && a.getRole() == AdminUser.AdminRole.SUPER_ADMIN)
                .isPresent();
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

    private void doScopedGrant(CreditAdjustmentRequest request,String actor) {
        var grant=scopedCredits.grant(request.getWalletId(),request.getCampaignId(),request.getAmount(),request.getExpiresAt(),
                "ops_scoped_grant",request.getId(),request.getReason(),actor);
        request.setGrantId(grant.getId());
        request.setLedgerEntryId(ledgerRepo.findByGrantIdAndEntryType(grant.getId(),LedgerEntry.LedgerEntryType.SCOPED_GRANT)
                .orElseThrow(()->new IllegalStateException("Scoped grant ledger missing")).getId());
    }

    private static String requireBounded(String value,int max,String message) {
        String result=requireText(value,"SCOPED_GRANT_INVALID",message);
        if(result.length()>max)throw BusinessException.badRequest("SCOPED_GRANT_INVALID",message+"（最多 "+max+" 字）");
        return result;
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
