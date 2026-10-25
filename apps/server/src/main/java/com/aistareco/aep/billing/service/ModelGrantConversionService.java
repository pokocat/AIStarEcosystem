package com.aistareco.aep.billing.service;

import com.aistareco.aep.billing.repository.CreditGrantRepository;
import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.model.CreditAdjustmentRequest;
import com.aistareco.aep.model.Wallet;
import com.aistareco.aep.repository.AdminUserRepository;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.AuditLogRepository;
import com.aistareco.aep.repository.CreditAdjustmentRequestRepository;
import com.aistareco.aep.repository.WalletRepository;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

/**
 * Converts customers' ordinary non-cash credits (gift, then license) into a model grant, keeping a fixed general balance.
 * Each customer is converted in its own transaction: the withdrawal ledger row and the grant commit together, and a
 * repeated batch skips customers it already converted. Recharge credits are paid money and are never converted.
 */
@Service
public class ModelGrantConversionService {
    private static final Logger log = LoggerFactory.getLogger(ModelGrantConversionService.class);
    public static final String SOURCE = "ops_grant_conversion";

    private final CreditService credits;
    private final ScopedCreditService scoped;
    private final CreditGrantRepository grants;
    private final WalletRepository wallets;
    private final AepUserRepository users;
    private final AdminUserRepository admins;
    private final CreditAdjustmentRequestRepository adjustments;
    private final AuditLogRepository audits;
    private final ObjectMapper mapper;
    private final TransactionTemplate perCustomer;

    public ModelGrantConversionService(CreditService credits, ScopedCreditService scoped, CreditGrantRepository grants,
            WalletRepository wallets, AepUserRepository users, AdminUserRepository admins,
            CreditAdjustmentRequestRepository adjustments, AuditLogRepository audits, ObjectMapper mapper,
            PlatformTransactionManager transactions) {
        this.credits = credits; this.scoped = scoped; this.grants = grants; this.wallets = wallets; this.users = users;
        this.admins = admins; this.adjustments = adjustments; this.audits = audits; this.mapper = mapper;
        this.perCustomer = new TransactionTemplate(transactions);
        perCustomer.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        // Same isolation as ScopedCreditService.grant, which joins this transaction.
        perCustomer.setIsolationLevel(TransactionDefinition.ISOLATION_READ_COMMITTED);
    }

    public record Line(String userId, String walletId, String displayName, String phone, long giftBalance, long licenseBalance,
                       long rechargeBalance, long totalBalance, long keep, long amount, String status, String message) {}
    public record Request(String requestId, String campaignId, long keep, int validDays, List<String> userIds, String reason) {}

    /** Customers who received an approved ordinary gift or compensation in the last {@code days} days. */
    public List<Line> candidates(int days, long keep) {
        if (days < 1 || days > 90) throw bad("请选择 1 到 90 天");
        var since = Instant.now().minus(days, ChronoUnit.DAYS);
        var ids = new LinkedHashSet<String>();
        adjustments.findByTypeInAndStatusAndCreatedAtGreaterThanEqualOrderByCreatedAtAsc(
                List.of(CreditAdjustmentRequest.Type.GRANT, CreditAdjustmentRequest.Type.COMPENSATE),
                CreditAdjustmentRequest.Status.APPROVED, since).forEach(r -> ids.add(r.getTargetUserId()));
        return preview(new ArrayList<>(ids), keep);
    }

    /** Read-only plan with current balances. Execution recomputes every amount under the wallet lock. */
    public List<Line> preview(List<String> userIds, long keep) {
        requireKeep(keep);
        return distinct(userIds).stream().map(id -> plan(id, keep)).toList();
    }

    public List<Line> execute(Request request, String actor) {
        requireSuperAdmin(actor);
        if (request == null) throw bad("缺少转换内容");
        String batch = request.requestId() == null ? "" : request.requestId().trim();
        if (!batch.matches("[A-Za-z0-9_-]{8,64}")) throw bad("请提供 8 到 64 位的转换编号");
        requireKeep(request.keep());
        if (request.validDays() < 1 || request.validDays() > 365) throw bad("赠款有效期应在 1 到 365 天之间");
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty() || reason.length() > 200) throw bad("请填写不超过 200 字的转换原因");
        if (request.campaignId() == null || request.campaignId().isBlank()) throw bad("请选择赠款活动");
        var ids = distinct(request.userIds());
        Instant expiresAt = Instant.now().plus(request.validDays(), ChronoUnit.DAYS);
        var results = new ArrayList<Line>();
        for (String userId : ids) {
            try {
                results.add(perCustomer.execute(status -> convertOne(userId, batch, request.campaignId(), request.keep(), expiresAt, reason, actor)));
            } catch (BusinessException e) {
                results.add(failed(userId, request.keep(), e.getCode() + "：" + e.getMessage()));
            } catch (RuntimeException e) {
                log.warn("[grant-conversion] batch={} user={} failed", batch, userId, e);
                results.add(failed(userId, request.keep(), e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage()));
            }
        }
        audit(actor, batch, request, results);
        return results;
    }

    private Line convertOne(String userId, String batch, String campaignId, long keep, Instant expiresAt, String reason, String actor) {
        Wallet wallet = wallets.findByUserIdForUpdate(userId).orElse(null);
        if (wallet == null) return line(userId, null, keep, 0, "nothing", "没有个人账户");
        String reference = batch + ":" + userId;
        var done = grants.lockBySourceAndSourceReference(SOURCE, reference).orElse(null);
        if (done != null) return line(userId, wallet, keep, done.getAmount(), "already", "这一批已经转过，没有重复扣");
        long amount = convertible(wallet, keep);
        if (amount <= 0) return line(userId, wallet, keep, 0, "nothing", "通用余额不超过保留额度");
        String description = "通用积分转为模型赠款（保留 " + keep + " 积分）";
        credits.withdrawNonCashForGrant(wallet.getId(), amount, SOURCE, reference, description);
        // Campaign expiry caps the grant: a grant can never outlive the campaign that scopes it.
        var campaignExpiry = scoped.campaignExpiry(campaignId);
        scoped.grant(wallet.getId(), campaignId, amount, expiresAt.isAfter(campaignExpiry) ? campaignExpiry : expiresAt,
                SOURCE, reference, reason, actor);
        var after = wallets.findById(wallet.getId()).orElse(wallet);
        return line(userId, after, keep, amount, "converted", null);
    }

    private Line plan(String userId, long keep) {
        Wallet wallet = wallets.findByUserId(userId).orElse(null);
        if (wallet == null) return line(userId, null, keep, 0, "nothing", "没有个人账户");
        long amount = convertible(wallet, keep);
        return line(userId, wallet, keep, amount, amount > 0 ? "ready" : "nothing", amount > 0 ? null : "通用余额不超过保留额度");
    }

    /** Everything above the kept general balance, but only from gift and license: recharge is paid money. */
    static long convertible(Wallet wallet, long keep) {
        long nonCash = Math.addExact(wallet.getGiftBalance(), wallet.getLicenseBalance());
        return Math.max(0, Math.min(nonCash, wallet.getTotalBalance() - keep));
    }

    private Line line(String userId, Wallet wallet, long keep, long amount, String status, String message) {
        var user = users.findById(userId).orElse(null);
        String name = user == null ? null : user.getDisplayName() == null ? user.getUsername() : user.getDisplayName();
        return new Line(userId, wallet == null ? null : wallet.getId(), name, user == null ? null : user.getPhone(),
                wallet == null ? 0 : wallet.getGiftBalance(), wallet == null ? 0 : wallet.getLicenseBalance(),
                wallet == null ? 0 : wallet.getRechargeBalance(), wallet == null ? 0 : wallet.getTotalBalance(),
                keep, amount, status, message);
    }
    private Line failed(String userId, long keep, String message) {
        var wallet = wallets.findByUserId(userId).orElse(null);
        return line(userId, wallet, keep, 0, "failed", message);
    }

    private void requireSuperAdmin(String actor) {
        var admin = actor == null ? null : admins.findById(actor).orElse(null);
        if (admin == null || admin.getStatus() != AdminUser.AdminStatus.ACTIVE || admin.getRole() != AdminUser.AdminRole.SUPER_ADMIN)
            throw new BusinessException(HttpStatus.FORBIDDEN, "GRANT_CONVERSION_FORBIDDEN", "只有超级管理员可以把通用积分转成模型赠款");
    }
    private static void requireKeep(long keep) {
        if (keep < 0 || keep > 1_000_000_000L) throw bad("保留额度无效");
    }
    private static List<String> distinct(List<String> userIds) {
        if (userIds == null || userIds.isEmpty()) throw bad("请选择要转换的客户");
        var ids = userIds.stream().filter(Objects::nonNull).map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        if (ids.isEmpty() || ids.size() > 200) throw bad("一次最多转换 200 位客户");
        return ids;
    }
    private void audit(String actor, String batch, Request request, List<Line> results) {
        try {
            var detail = new LinkedHashMap<String, Object>();
            detail.put("campaignId", request.campaignId()); detail.put("keep", request.keep()); detail.put("validDays", request.validDays());
            detail.put("reason", request.reason()); detail.put("results", results.stream().map(l -> Map.of("userId", l.userId(),
                    "amount", l.amount(), "status", l.status())).toList());
            audits.save(AuditLog.builder().id(UUID.randomUUID().toString()).userId(actor).appCode("admin")
                    .action("model_billing.grant_conversion").resourceType("model_grant_conversion").resourceId(batch)
                    .result(results.stream().anyMatch(l -> "failed".equals(l.status())) ? AuditLog.AuditResult.FAILURE : AuditLog.AuditResult.SUCCESS)
                    .detail(mapper.writeValueAsString(detail)).createdAt(Instant.now()).build());
        } catch (Exception e) {
            // Observability only: the ledger rows and grants are the source of truth.
            log.warn("[grant-conversion] audit write failed batch={}", batch, e);
        }
    }
    private static BusinessException bad(String message) { return BusinessException.badRequest("GRANT_CONVERSION_INVALID", message); }
}
