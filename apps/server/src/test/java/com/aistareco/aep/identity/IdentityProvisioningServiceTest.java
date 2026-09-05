package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * JIT 建档的原子性与 username 生成规则（docs/unified-identity-plan.md §12.1）。
 *
 * <p>并发首登用真线程 + 一个「只允许一个赢家」的内存表模拟数据库唯一约束：落败方必须
 * 捕获唯一键冲突后按 identity_uid **回读赢家**，而不是把 DataIntegrityViolationException
 * 透成 500，更不是插出第二行。
 */
class IdentityProvisioningServiceTest {

    private AepUserRepository repo;
    private IdentityUserInserter inserter;
    private IdentityCenterClient client;
    private IdentityProvisioningService service;

    private final ConcurrentHashMap<String, AepUser> rows = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Boolean> usernames = new ConcurrentHashMap<>();
    private final AtomicInteger insertAttempts = new AtomicInteger();

    @BeforeEach
    void setUp() {
        repo = mock(AepUserRepository.class);
        inserter = mock(IdentityUserInserter.class);
        client = mock(IdentityCenterClient.class);
        when(client.isEnabled()).thenReturn(false);

        when(repo.findByIdentityUid(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(rows.get(inv.getArgument(0, String.class))));

        when(inserter.insert(anyString(), anyString())).thenAnswer(inv -> {
            String uid = inv.getArgument(0);
            String username = inv.getArgument(1);
            insertAttempts.incrementAndGet();
            if (usernames.putIfAbsent(username, Boolean.TRUE) != null) {
                throw new DataIntegrityViolationException("duplicate username " + username);
            }
            AepUser candidate = AepUser.builder()
                    .id("local-" + insertAttempts.get())
                    .username(username)
                    .kind(AepUser.AccountKind.PERSONAL)
                    .status(AepUser.UserStatus.ACTIVE)
                    .platforms("")
                    .identityUid(uid)
                    .createdAt(Instant.now())
                    .build();
            AepUser winner = rows.putIfAbsent(uid, candidate);
            if (winner != null) {
                throw new DataIntegrityViolationException("duplicate identity_uid " + uid);
            }
            return candidate;
        });

        service = new IdentityProvisioningService(repo, inserter, client, noEnrollment());
    }

    @Test
    void usernameDerivedFromFirst12CharsOfUid() {
        assertThat(IdentityProvisioningService.candidateUsername("01HZABCDEFGHJKMNPQRS", 0))
                .isEqualTo("id_01hzabcdefgh");
        assertThat(IdentityProvisioningService.candidateUsername("short", 0)).isEqualTo("id_short");
        assertThat(IdentityProvisioningService.candidateUsername("short", 1)).isEqualTo("id_short_2");
    }

    @Test
    void existingLocalUserIsReturnedWithoutInserting() {
        rows.put("uid-known", AepUser.builder().id("local-known").identityUid("uid-known")
                .kind(AepUser.AccountKind.STUDIO).status(AepUser.UserStatus.ACTIVE).build());

        AepUser resolved = service.resolveOrProvision("uid-known");

        assertThat(resolved.getId()).isEqualTo("local-known");
        assertThat(insertAttempts.get()).isZero();
    }

    @Test
    void usernameCollisionRetriesWithSuffix() {
        usernames.put("id_uid-collide", Boolean.TRUE);   // 该 username 已被别人占用

        AepUser resolved = service.resolveOrProvision("uid-collide");

        assertThat(resolved.getUsername()).isEqualTo("id_uid-collide_2");
        assertThat(insertAttempts.get()).isEqualTo(2);
    }

    @Test
    void concurrentFirstLoginCreatesExactlyOneRow() throws Exception {
        int threads = 8;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CyclicBarrier gate = new CyclicBarrier(threads);
        try {
            java.util.List<Future<AepUser>> futures = new java.util.ArrayList<>();
            for (int i = 0; i < threads; i++) {
                futures.add(pool.submit(() -> {
                    gate.await(5, TimeUnit.SECONDS);
                    return service.resolveOrProvision("uid-race");
                }));
            }
            String firstId = null;
            for (Future<AepUser> future : futures) {
                AepUser user = future.get(10, TimeUnit.SECONDS);
                if (firstId == null) firstId = user.getId();
                assertThat(user.getId()).as("所有并发请求必须落到同一行").isEqualTo(firstId);
            }
            assertThat(rows).hasSize(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void blankUidRejected() {
        try {
            service.resolveOrProvision("  ");
            org.junit.jupiter.api.Assertions.fail("空 uid 必须拒绝");
        } catch (IllegalArgumentException expected) {
            assertThat(expected).hasMessageContaining("identityUid");
        }
        verify(inserter, org.mockito.Mockito.never()).insert(anyString(), anyString());
    }

    /** 单测不装 EnrollmentService：ObjectProvider 返回空，JIT 后的开通策略静默跳过。 */
    private static org.springframework.beans.factory.ObjectProvider<com.aistareco.aep.enrollment.service.EnrollmentService> noEnrollment() {
        return new org.springframework.beans.factory.support.DefaultListableBeanFactory()
                .getBeanProvider(com.aistareco.aep.enrollment.service.EnrollmentService.class);
    }
}
