package com.aistareco.aep.identity;

import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 账号中心事件消费（docs/unified-identity-plan.md §12.4）。
 *
 * <p>覆盖三条真实语义：
 * <ul>
 *   <li>USER_MERGED，存活方本地没有档案 → 被并方档案改指新 uid（数据原样留在本地那一行）</li>
 *   <li>USER_MERGED，存活方本地已有档案 → **不自动合并**：被并方解绑 uid + 停用，等人工处理</li>
 *   <li>USER_CLOSED → 本地档案 DELETED，identity_uid 保留作墓碑</li>
 * </ul>
 * 外加游标语义：处理成功才前进；中途失败就地停住，失败那条下轮重放（handler 幂等）。
 */
class IdentityOutboxTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private AepUserRepository userRepo;
    private IdentityOutboxHandler handler;
    private final Map<String, AepUser> rows = new HashMap<>();

    @BeforeEach
    void setUp() {
        userRepo = mock(AepUserRepository.class);
        when(userRepo.findByIdentityUid(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(rows.get(inv.getArgument(0, String.class))));
        when(userRepo.save(any(AepUser.class))).thenAnswer(inv -> inv.getArgument(0));
        handler = new IdentityOutboxHandler(userRepo);
    }

    private IdentityCenterClient.OutboxEvent event(long id, String type, String uid, String payloadJson) {
        try {
            return new IdentityCenterClient.OutboxEvent(id, type, uid,
                    payloadJson == null ? null : MAPPER.readTree(payloadJson));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private AepUser row(String id, String uid) {
        AepUser user = AepUser.builder().id(id).username(id).identityUid(uid)
                .kind(AepUser.AccountKind.PERSONAL).status(AepUser.UserStatus.ACTIVE).build();
        rows.put(uid, user);
        return user;
    }

    @Test
    void merged_repointsLocalUserWhenSurvivorHasNoLocalRow() {
        AepUser local = row("local-a", "uid-a");

        handler.handle(event(1, "USER_MERGED", "uid-a", "{\"fromUid\":\"uid-a\",\"toUid\":\"uid-b\"}"));

        assertThat(local.getIdentityUid()).isEqualTo("uid-b");
        assertThat(local.getStatus()).isEqualTo(AepUser.UserStatus.ACTIVE);
    }

    @Test
    void merged_withConflictSuspendsLosingLocalUser() {
        AepUser losing = row("local-a", "uid-a");
        AepUser surviving = row("local-b", "uid-b");

        handler.handle(event(2, "USER_MERGED", "uid-a", "{\"fromUid\":\"uid-a\",\"toUid\":\"uid-b\"}"));

        assertThat(losing.getIdentityUid()).as("解绑，避免两行抢同一个 uid").isNull();
        assertThat(losing.getStatus()).isEqualTo(AepUser.UserStatus.SUSPENDED);
        assertThat(surviving.getStatus()).as("存活方不动").isEqualTo(AepUser.UserStatus.ACTIVE);
    }

    @Test
    void merged_isIdempotentWhenReplayed() {
        AepUser local = row("local-a", "uid-a");
        var e = event(3, "USER_MERGED", "uid-a", "{\"fromUid\":\"uid-a\",\"toUid\":\"uid-b\"}");

        handler.handle(e);
        rows.remove("uid-a");
        rows.put("uid-b", local);
        handler.handle(e);   // 重放：fromUid 已经没有本地档案 → no-op

        assertThat(local.getIdentityUid()).isEqualTo("uid-b");
        assertThat(local.getStatus()).isEqualTo(AepUser.UserStatus.ACTIVE);
    }

    @Test
    void closed_marksLocalUserDeletedAndKeepsUidAsTombstone() {
        AepUser local = row("local-c", "uid-c");

        handler.handle(event(4, "USER_CLOSED", "uid-c", "{\"uid\":\"uid-c\"}"));

        assertThat(local.getStatus()).isEqualTo(AepUser.UserStatus.DELETED);
        assertThat(local.getIdentityUid()).isEqualTo("uid-c");
    }

    @Test
    void phoneChangedAndUnknownTypesAreIgnored() {
        AepUser local = row("local-d", "uid-d");

        handler.handle(event(5, "PHONE_CHANGED", "uid-d", "{\"phone\":\"138****0000\"}"));
        handler.handle(event(6, "SOMETHING_NEW", "uid-d", "{}"));

        assertThat(local.getStatus()).isEqualTo(AepUser.UserStatus.ACTIVE);
        verify(userRepo, times(0)).save(any(AepUser.class));
    }

    // -------------------------------------------------------- 坏 payload 不静默确认

    @Test
    void mergedWithBrokenPayloadThrowsInsteadOfSilentlySkipping() {
        row("local-e", "uid-e");
        // 缺 toUid：以前只打一行 WARN、游标照样越过去，这条事件就永远丢了
        assertThatThrownBy(() -> handler.handle(event(7, "USER_MERGED", "uid-e", "{\"fromUid\":\"uid-e\"}")))
                .isInstanceOf(IdentityOutboxHandler.InvalidEventPayloadException.class)
                .hasMessageContaining("USER_MERGED");
    }

    @Test
    void closedWithoutUidThrows() {
        assertThatThrownBy(() -> handler.handle(event(8, "USER_CLOSED", null, "{}")))
                .isInstanceOf(IdentityOutboxHandler.InvalidEventPayloadException.class)
                .hasMessageContaining("USER_CLOSED");
    }

    // ---------------------------------------------------------------- poller

    @Test
    void pollerAdvancesCursorOnlyPastProcessedEvents() {
        IdentityProperties props = new IdentityProperties();
        props.setIssuer("https://id.aibuzz.test");
        props.setClientSecret("secret");

        IdentityCenterClient client = mock(IdentityCenterClient.class);
        when(client.fetchOutbox(anyLong(), anyInt())).thenReturn(List.of(
                event(11, "USER_CLOSED", "uid-x", "{\"uid\":\"uid-x\"}"),
                event(12, "USER_CLOSED", "uid-boom", "{\"uid\":\"uid-boom\"}"),
                event(13, "USER_CLOSED", "uid-z", "{\"uid\":\"uid-z\"}")));

        IdentityOutboxHandler failing = mock(IdentityOutboxHandler.class);
        org.mockito.Mockito.doThrow(new IllegalStateException("db down"))
                .when(failing).handle(org.mockito.ArgumentMatchers.argThat(e -> e != null && e.id() == 12));

        PlatformConfigRepository configRepo = mock(PlatformConfigRepository.class);
        when(configRepo.findByConfigKey(IdentityOutboxPoller.CURSOR_KEY)).thenReturn(Optional.empty());
        when(configRepo.save(any(PlatformConfig.class))).thenAnswer(inv -> inv.getArgument(0));

        IdentityOutboxPoller poller = new IdentityOutboxPoller(props, client, failing, configRepo);
        int done = poller.pollOnce();

        assertThat(done).as("只有 11 处理成功，12 抛异常后就地停住").isEqualTo(1);
        var captor = org.mockito.ArgumentCaptor.forClass(PlatformConfig.class);
        verify(configRepo).save(captor.capture());
        assertThat(captor.getValue().getValueJson()).isEqualTo("11");
    }

    @Test
    void pollerDoesNothingWhenIdentityCenterNotConfigured() {
        IdentityProperties props = new IdentityProperties();   // issuer 空 = 关闭
        IdentityCenterClient client = mock(IdentityCenterClient.class);
        PlatformConfigRepository configRepo = mock(PlatformConfigRepository.class);

        new IdentityOutboxPoller(props, client, handler, configRepo).poll();

        verify(client, times(0)).fetchOutbox(anyLong(), anyInt());
        verify(configRepo, times(0)).save(any(PlatformConfig.class));
    }

    @Test
    void pollerParksPersistentlyFailingEventInDeadLetterAndMovesOn() {
        IdentityProperties props = new IdentityProperties();
        props.setIssuer("https://id.aibuzz.test");
        props.setClientSecret("secret");

        IdentityCenterClient client = mock(IdentityCenterClient.class);
        when(client.fetchOutbox(anyLong(), anyInt())).thenAnswer(inv -> {
            long after = inv.getArgument(0, Long.class);
            return List.of(
                    event(11, "USER_CLOSED", "uid-x", "{\"uid\":\"uid-x\"}"),
                    event(12, "USER_MERGED", "uid-boom", "{\"fromUid\":\"uid-boom\"}"),
                    event(13, "USER_CLOSED", "uid-z", "{\"uid\":\"uid-z\"}"))
                    .stream().filter(e -> e.id() > after).toList();
        });

        IdentityOutboxHandler failing = mock(IdentityOutboxHandler.class);
        org.mockito.Mockito.doThrow(new IdentityOutboxHandler.InvalidEventPayloadException("坏 payload"))
                .when(failing).handle(org.mockito.ArgumentMatchers.argThat(e -> e != null && e.id() == 12));

        PlatformConfigRepository configRepo = inMemoryConfigRepo();
        IdentityOutboxPoller poller = new IdentityOutboxPoller(props, client, failing, configRepo);

        // 前 4 轮：12 反复失败，游标停在 11，13 迟迟处理不到
        for (int i = 0; i < IdentityOutboxPoller.MAX_CONSECUTIVE_FAILURES - 1; i++) {
            poller.pollOnce();
            assertThat(poller.readCursor()).as("第 %d 轮游标不前进", i + 1).isEqualTo(11L);
            assertThat(poller.readDeadLetters().size()).isZero();
        }

        // 第 5 轮：12 转死信，游标越过它，13 终于被处理
        int done = poller.pollOnce();
        assertThat(done).as("本轮只有 13 成功").isEqualTo(1);
        assertThat(poller.readCursor()).isEqualTo(13L);

        var deadLetters = poller.readDeadLetters();
        assertThat(deadLetters.size()).isEqualTo(1);
        assertThat(deadLetters.get(0).path("id").asLong()).isEqualTo(12L);
        assertThat(deadLetters.get(0).path("eventType").asText()).isEqualTo("USER_MERGED");
        assertThat(deadLetters.get(0).path("reason").asText()).contains("坏 payload");
        assertThat(deadLetters.get(0).path("at").asText()).isNotBlank();
    }

    /**
     * 死信落在 {@code aep_platform_configs} 里，而 {@code /api/config} 是匿名可读的公开接口 ——
     * 所以 {@code reason} 里不许出现 uid / 手机号，只留「异常类名 + 脱敏短消息」。
     * uid 只出现在本地 ERROR 日志。
     */
    @Test
    void deadLetterReasonCarriesNoAccountIdentifiers() {
        IdentityProperties props = new IdentityProperties();
        props.setIssuer("https://id.aibuzz.test");
        props.setClientSecret("secret");

        IdentityCenterClient client = mock(IdentityCenterClient.class);
        when(client.fetchOutbox(anyLong(), anyInt())).thenAnswer(inv -> {
            long after = inv.getArgument(0, Long.class);
            return List.of(event(31, "USER_MERGED", "uid-boom",
                            "{\"fromUid\":\"6f1d2c3b-aaaa-4bbb-8ccc-1234567890ab\"}"))
                    .stream().filter(e -> e.id() > after).toList();
        });

        // 真实 handler 抛出的消息形如：USER_MERGED payload 不合法 id=31 fromUid=<uid> toUid=null
        IdentityOutboxHandler failing = mock(IdentityOutboxHandler.class);
        org.mockito.Mockito.doThrow(new IdentityOutboxHandler.InvalidEventPayloadException(
                        "USER_MERGED payload 不合法 id=31"
                                + " fromUid=6f1d2c3b-aaaa-4bbb-8ccc-1234567890ab"
                                + " toUid=9a8b7c6d-eeee-4fff-8000-0987654321fe phone=13800000000"))
                .when(failing).handle(org.mockito.ArgumentMatchers.any());

        PlatformConfigRepository configRepo = inMemoryConfigRepo();
        IdentityOutboxPoller poller = new IdentityOutboxPoller(props, client, failing, configRepo);
        for (int i = 0; i < IdentityOutboxPoller.MAX_CONSECUTIVE_FAILURES; i++) poller.pollOnce();

        var deadLetters = poller.readDeadLetters();
        assertThat(deadLetters.size()).isEqualTo(1);
        String reason = deadLetters.get(0).path("reason").asText();

        assertThat(reason).as("保留可诊断的异常类型").startsWith("InvalidEventPayloadException");
        assertThat(reason).as("保留可诊断的业务语义").contains("USER_MERGED");
        assertThat(reason).as("uid / 手机号一律脱敏")
                .doesNotContain("6f1d2c3b")
                .doesNotContain("9a8b7c6d")
                .doesNotContain("13800000000");
        // 整行配置里也不能有（防止别的字段夹带）
        assertThat(deadLetters.toString()).doesNotContain("6f1d2c3b").doesNotContain("13800000000");
    }

    /** reason 是「异常类名 + 脱敏短消息」，且不会被一条长堆栈撑爆。 */
    @Test
    void safeReasonScrubsAndTruncates() {
        assertThat(IdentityOutboxPoller.safeReason(new IllegalStateException("db down")))
                .isEqualTo("IllegalStateException: db down");
        assertThat(IdentityOutboxPoller.safeReason(new IllegalStateException("uid=abc toUid=def ok")))
                .isEqualTo("IllegalStateException: uid=*** toUid=*** ok");
        assertThat(IdentityOutboxPoller.safeReason(new IllegalStateException((String) null)))
                .isEqualTo("IllegalStateException");
        assertThat(IdentityOutboxPoller.safeReason(null)).isEqualTo("unknown");
        assertThat(IdentityOutboxPoller.safeReason(new IllegalStateException("x".repeat(500))).length())
                .isLessThan(260);
    }

    /** 交替失败的两条事件不应互相累计计数（否则会提前把好事件也扔进死信）。 */
    @Test
    void failureCounterResetsWhenADifferentEventFails() {
        IdentityProperties props = new IdentityProperties();
        props.setIssuer("https://id.aibuzz.test");
        props.setClientSecret("secret");

        IdentityCenterClient client = mock(IdentityCenterClient.class);
        when(client.fetchOutbox(anyLong(), anyInt())).thenReturn(
                List.of(event(21, "USER_CLOSED", "uid-a", "{\"uid\":\"uid-a\"}")),
                List.of(event(22, "USER_CLOSED", "uid-b", "{\"uid\":\"uid-b\"}")),
                List.of(event(21, "USER_CLOSED", "uid-a", "{\"uid\":\"uid-a\"}")));

        IdentityOutboxHandler failing = mock(IdentityOutboxHandler.class);
        org.mockito.Mockito.doThrow(new IllegalStateException("db down"))
                .when(failing).handle(org.mockito.ArgumentMatchers.any());

        PlatformConfigRepository configRepo = inMemoryConfigRepo();
        IdentityOutboxPoller poller = new IdentityOutboxPoller(props, client, failing, configRepo);
        poller.pollOnce();
        poller.pollOnce();
        poller.pollOnce();

        assertThat(poller.readDeadLetters().size()).as("没有任何一条连续失败满 5 轮").isZero();
        assertThat(poller.readCursor()).isEqualTo(0L);
    }

    /** 极简的内存版 PlatformConfig 仓库：游标 / 死信要能真读回来。 */
    private static PlatformConfigRepository inMemoryConfigRepo() {
        Map<String, PlatformConfig> store = new HashMap<>();
        PlatformConfigRepository repo = mock(PlatformConfigRepository.class);
        when(repo.findByConfigKey(anyString()))
                .thenAnswer(inv -> Optional.ofNullable(store.get(inv.getArgument(0, String.class))));
        when(repo.save(any(PlatformConfig.class))).thenAnswer(inv -> {
            PlatformConfig row = inv.getArgument(0);
            store.put(row.getConfigKey(), row);
            return row;
        });
        return repo;
    }
}
