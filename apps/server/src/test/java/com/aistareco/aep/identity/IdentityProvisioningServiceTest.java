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

    // ── 从账号中心令牌回填身份字段（昵称 / 头像 / 手机号验证位）──────────────────

    /**
     * 昵称与头像来自账号中心，不再各产品自己编（aibuzz-id README §22）。
     *
     * <p>以前 JIT 建档只写 {@code username = id_<uid 前 12 位>}，{@code displayName}
     * 一直是空的，界面只能显示那串 {@code id_xxxx} —— 同一个人在每个产品里叫的名字都不一样。
     */
    @Test
    void syncFromIdentityToken_writesNicknameAndAvatar() {
        AepUser user = existingLocalUser();

        service.syncFromIdentityToken(user.getId(), true, "静谧山雀418", "https://cdn/x.png");

        assertThat(user.getDisplayName()).isEqualTo("静谧山雀418");
        assertThat(user.getAvatarUrl()).isEqualTo("https://cdn/x.png");
        assertThat(user.isPhoneVerified()).isTrue();
        verify(repo).save(user);
    }

    /**
     * 令牌没带这两个 claim（老版本账号中心签的）时<b>保留</b>本地已有的值。
     *
     * <p>拿 null 去清空的后果是：一个老令牌的请求过来，界面上的名字就忽然消失了。
     */
    @Test
    void syncFromIdentityToken_withoutTheClaims_keepsWhatIsAlreadyThere() {
        AepUser user = existingLocalUser();
        user.setDisplayName("原来的名字");
        user.setAvatarUrl("https://cdn/old.png");

        service.syncFromIdentityToken(user.getId(), true, null, "   ");

        assertThat(user.getDisplayName()).isEqualTo("原来的名字");
        assertThat(user.getAvatarUrl()).isEqualTo("https://cdn/old.png");
    }

    /**
     * 什么都没变就<b>不写库</b>。
     *
     * <p>这个方法每个请求都会被调到，无条件 save 等于给每次 API 调用加一次 UPDATE。
     */
    @Test
    void syncFromIdentityToken_withNothingChanged_doesNotWrite() {
        AepUser user = existingLocalUser();
        user.setDisplayName("静谧山雀418");
        user.setAvatarUrl("https://cdn/x.png");
        user.setPhoneVerified(true);

        service.syncFromIdentityToken(user.getId(), true, "静谧山雀418", "https://cdn/x.png");

        verify(repo, org.mockito.Mockito.never()).save(org.mockito.ArgumentMatchers.any());
    }

    private AepUser existingLocalUser() {
        AepUser user = AepUser.builder()
                .id("local-1")
                .username("id_abcdef123456")
                .kind(AepUser.AccountKind.PERSONAL)
                .status(AepUser.UserStatus.ACTIVE)
                .platforms("")
                .identityUid("U-1")
                .createdAt(Instant.now())
                .build();
        when(repo.findById("local-1")).thenReturn(Optional.of(user));
        return user;
    }

    /** 单测不装 EnrollmentService：ObjectProvider 返回空，JIT 后的开通策略静默跳过。 */
    private static org.springframework.beans.factory.ObjectProvider<com.aistareco.aep.enrollment.service.EnrollmentService> noEnrollment() {
        return new org.springframework.beans.factory.support.DefaultListableBeanFactory()
                .getBeanProvider(com.aistareco.aep.enrollment.service.EnrollmentService.class);
    }
}
