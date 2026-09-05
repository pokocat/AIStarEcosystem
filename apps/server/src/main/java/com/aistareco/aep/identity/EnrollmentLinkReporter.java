package com.aistareco.aep.identity;

import com.aistareco.aep.enrollment.event.EnrollmentActivatedEvent;
import com.aistareco.aep.repository.AepUserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 子产品开通成功后，把账号中心那边的只读汇总 {@code id_product_link} 推成 ACTIVE
 * （docs/unified-identity-plan.md §7 第 6 步、§12.2）。
 *
 * <p>事务提交后才发（AFTER_COMMIT），回滚的激活不会误报；调用本身 best-effort（{@link IdentityCenterClient#reportLink}
 * 只 WARN 不抛），账号中心抖动绝不影响用户已经拿到的权益。没有 {@code identityUid} 的老账号（legacy 登录）跳过。</p>
 */
@Component
public class EnrollmentLinkReporter {

    private static final Logger log = LoggerFactory.getLogger(EnrollmentLinkReporter.class);

    private final AepUserRepository users;
    private final IdentityCenterClient client;
    private final IdentityProperties props;

    public EnrollmentLinkReporter(AepUserRepository users, IdentityCenterClient client, IdentityProperties props) {
        this.users = users;
        this.client = client;
        this.props = props;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onActivated(EnrollmentActivatedEvent event) {
        if (!props.isMachineCallEnabled()) return;
        users.findById(event.userId()).ifPresent(user -> {
            if (user.getIdentityUid() == null || user.getIdentityUid().isBlank()) {
                log.debug("[identity] 开通回报跳过：本地用户 {} 尚无 identityUid（legacy 账号）", user.getId());
                return;
            }
            client.reportLink(user.getIdentityUid(), user.getId(), "ACTIVE");
        });
    }
}
