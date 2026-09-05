package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * JIT 建档的**插入**动作，单独成 bean 只为拿到独立事务
 * （{@link Propagation#REQUIRES_NEW}）—— 同类内自调用不走代理，拿不到新事务。
 *
 * <p>唯一键冲突（identity_uid / username）由 {@code saveAndFlush} 在方法内抛出，
 * 该事务回滚而不污染调用方；调用方据此按 identity_uid 回读赢家（§12.1 原子性要求）。
 */
@Component
public class IdentityUserInserter {

    private final AepUserRepository userRepo;

    public IdentityUserInserter(AepUserRepository userRepo) {
        this.userRepo = userRepo;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AepUser insert(String identityUid, String username) {
        Instant now = Instant.now();
        AepUser user = AepUser.builder()
                .id(UUID.randomUUID().toString())
                .username(username)
                .kind(AepUser.AccountKind.PERSONAL)
                .status(AepUser.UserStatus.ACTIVE)
                // §12.1：platforms 留空。注意 v0.149 起空 CSV **不再**等于「全部可访问」——
                // 能进哪些子产品由 enrollment 决定（§12.2），这里不授予任何东西。
                .platforms("")
                .identityUid(identityUid)
                .emailVerified(false)
                .phoneVerified(false)
                .createdAt(now)
                .updatedAt(now)
                .build();
        return userRepo.saveAndFlush(user);
    }
}
