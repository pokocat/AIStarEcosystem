package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;

/**
 * uid → 本地档案解析（{@code docs/unified-identity-plan.md} §12.1「主体解析」）。
 *
 * <p>顺序：{@code aep_users.identity_uid} 命中 → 直接返回；未命中 → **JIT 建档**
 * （{@code kind=PERSONAL} / {@code status=ACTIVE} / {@code username="id_"+uid 前 12 位}
 * / {@code platforms=""}），先插后读：唯一键冲突时按 identity_uid 回读赢家，
 * 并发首登只会有一行。
 *
 * <p>建档成功后 best-effort 回报账号中心 {@code PUT /api/products/aistar/links/{uid}}
 * {@code {localSubjectId, PROVISIONED}}；回报走独立线程，失败只 WARN——**绝不**让账号中心
 * 抖动把用户挡在登录外（§8.0 旁路写入例外）。
 *
 * <p><b>JIT 建档 ≠ 开通</b>：这里只保证「这个人在本产品有一行档案」，能不能用某个子产品由
 * enrollment 决定（§12.2，另一路实现）。
 */
@Service
public class IdentityProvisioningService {

    private static final Logger log = LoggerFactory.getLogger(IdentityProvisioningService.class);

    /** username 冲突时的重试上限（uid 前缀相同的概率极低，纯防御）。 */
    private static final int MAX_ATTEMPTS = 5;

    private final AepUserRepository userRepo;
    private final IdentityUserInserter inserter;
    private final IdentityCenterClient centerClient;
    private final org.springframework.beans.factory.ObjectProvider<com.aistareco.aep.enrollment.service.EnrollmentService> enrollments;
    private final ExecutorService reportExecutor;

    public IdentityProvisioningService(AepUserRepository userRepo,
                                       IdentityUserInserter inserter,
                                       IdentityCenterClient centerClient,
                                       org.springframework.beans.factory.ObjectProvider<com.aistareco.aep.enrollment.service.EnrollmentService> enrollments) {
        this.userRepo = userRepo;
        this.inserter = inserter;
        this.centerClient = centerClient;
        this.enrollments = enrollments;
        this.reportExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "identity-link-report");
            t.setDaemon(true);
            return t;
        });
    }

    /** 已存在则返回，不存在则 JIT 建档。uid 为空 → 抛 IllegalArgumentException。 */
    public AepUser resolveOrProvision(String identityUid) {
        if (identityUid == null || identityUid.isBlank()) {
            throw new IllegalArgumentException("identityUid 不能为空");
        }
        String uid = identityUid.trim();
        Optional<AepUser> existing = userRepo.findByIdentityUid(uid);
        if (existing.isPresent()) return existing.get();

        for (int attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            String username = candidateUsername(uid, attempt);
            try {
                AepUser created = inserter.insert(uid, username);
                log.info("[identity] JIT 建档 uid={} localUserId={} username={}",
                        uid, created.getId(), created.getUsername());
                // §12.2 新用户开通策略：dev（dev-grant-all）→ 五个产品 ACTIVE/GRANT_ALL；生产 → 一条都不建，进产品看到开通页。
                // 只有真正插入成功的这条线程执行，回读赢家的败方不会重复授予（幂等 upsert 亦兜底）。
                grantForNewUserSafely(created.getId());
                reportLinkAsync(uid, created.getId());
                return created;
            } catch (DataIntegrityViolationException e) {
                // 可能是 identity_uid 撞（并发首登，回读赢家）或 username 撞（换个后缀重试）
                Optional<AepUser> winner = userRepo.findByIdentityUid(uid);
                if (winner.isPresent()) {
                    log.debug("[identity] JIT 建档并发落败，回读赢家 uid={} localUserId={}",
                            uid, winner.get().getId());
                    return winner.get();
                }
                log.warn("[identity] JIT 建档 username 冲突，重试 uid={} username={} attempt={}",
                        uid, username, attempt);
            }
        }
        throw new IllegalStateException("JIT 建档失败：username 连续冲突 uid=" + uid);
    }

    private void grantForNewUserSafely(String localUserId) {
        try {
            var svc = enrollments.getIfAvailable();
            if (svc != null) svc.grantForNewUser(localUserId, null);
        } catch (RuntimeException e) {
            // 开通策略失败不应让登录失败：用户至多看到开通页，可凭激活码补开通。
            log.warn("[identity] JIT 建档后的新用户开通策略执行失败 localUserId={}：{}", localUserId, e.toString());
        }
    }

    /** {@code id_<uid 前 12 位>}；attempt>0 时补 {@code _2} / {@code _3} … 后缀保唯一。 */
    static String candidateUsername(String uid, int attempt) {
        String sanitized = uid.replaceAll("[^A-Za-z0-9_-]", "").toLowerCase(Locale.ROOT);
        if (sanitized.isEmpty()) sanitized = Integer.toHexString(uid.hashCode());
        String base = "id_" + sanitized.substring(0, Math.min(12, sanitized.length()));
        return attempt == 0 ? base : base + "_" + (attempt + 1);
    }

    private void reportLinkAsync(String uid, String localUserId) {
        if (!centerClient.isEnabled()) return;
        try {
            reportExecutor.submit(() ->
                    centerClient.reportLink(uid, localUserId, IdentityCenterClient.LINK_PROVISIONED));
        } catch (RejectedExecutionException e) {
            log.warn("[identity] link 回报入队失败（忽略） uid={}", uid);
        }
    }
}
