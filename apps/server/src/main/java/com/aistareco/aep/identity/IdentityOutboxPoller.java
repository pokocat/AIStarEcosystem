package com.aistareco.aep.identity;

import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 账号中心事件消费（{@code docs/unified-identity-plan.md} §12.4）。
 *
 * <p>pull 模型：按 id 游标拉 {@code /api/products/aistar/outbox?after=&limit=}。
 * 游标存 {@code aep_platform_configs} 的 {@code identity.outbox.cursor}。
 *
 * <p>游标推进规则：**只推进到本批最后一条处理成功的事件**。中途某条抛异常就地停住，
 * 游标停在它前面，下轮重试 —— 宁可重放（handler 幂等）也不跳过。
 *
 * <p><b>死信（v0.150）</b>：同一条事件连续 {@value #MAX_CONSECUTIVE_FAILURES} 轮失败后，
 * 记进 {@code identity.outbox.deadletter}（{@code [{id,eventType,reason,at}]}）并 ERROR 放行，
 * 否则一条坏事件会把整条流永久堵死。计数是进程内的：重启从 0 开始重数，
 * 这只影响「多试几轮」，不影响正确性。</p>
 *
 * <p>未配置账号中心（issuer / client-secret 任一为空）→ 每轮直接返回，不打日志噪音。
 */
@Component
public class IdentityOutboxPoller {

    private static final Logger log = LoggerFactory.getLogger(IdentityOutboxPoller.class);
    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** 游标配置键（§12.4 指定）。 */
    public static final String CURSOR_KEY = "identity.outbox.cursor";

    /** 死信配置键：JSON 数组 {@code [{id,eventType,reason,at}]}。 */
    public static final String DEADLETTER_KEY = "identity.outbox.deadletter";

    /** 同一条事件连续失败多少轮后转死信并放行。 */
    public static final int MAX_CONSECUTIVE_FAILURES = 5;

    /** 死信最多保留多少条（超出丢最早的，避免这一行配置无限膨胀）。 */
    private static final int DEADLETTER_CAP = 200;

    private static final int BATCH_LIMIT = 200;

    private final IdentityProperties props;
    private final IdentityCenterClient client;
    private final IdentityOutboxHandler handler;
    private final PlatformConfigRepository configRepo;

    /** 当前正在连续失败的事件 id 与次数（进程内计数，见类注释）。 */
    private long failingEventId;
    private int consecutiveFailures;

    public IdentityOutboxPoller(IdentityProperties props,
                                 IdentityCenterClient client,
                                 IdentityOutboxHandler handler,
                                 PlatformConfigRepository configRepo) {
        this.props = props;
        this.client = client;
        this.handler = handler;
        this.configRepo = configRepo;
    }

    @Scheduled(fixedDelayString = "#{${aep.identity.outbox-poll-seconds:30} * 1000}",
            initialDelayString = "#{${aep.identity.outbox-poll-seconds:30} * 1000}")
    public void poll() {
        if (!props.isMachineCallEnabled()) return;
        try {
            pollOnce();
        } catch (RuntimeException e) {
            log.warn("[identity] outbox 轮询异常（下轮重试） err={}", e.toString());
        }
    }

    /** 拉一批并处理；返回本轮成功处理的事件数（测试直接调这个，不等调度）。 */
    public int pollOnce() {
        long cursor = readCursor();
        List<IdentityCenterClient.OutboxEvent> events = client.fetchOutbox(cursor, BATCH_LIMIT);
        if (events.isEmpty()) return 0;

        int done = 0;
        long lastOk = cursor;
        for (IdentityCenterClient.OutboxEvent event : events) {
            try {
                handler.handle(event);
                lastOk = Math.max(lastOk, event.id());
                done++;
                clearFailure(event.id());
            } catch (RuntimeException e) {
                int failures = noteFailure(event.id());
                if (failures >= MAX_CONSECUTIVE_FAILURES) {
                    parkDeadLetter(event, e);
                    lastOk = Math.max(lastOk, event.id());
                    clearFailure(event.id());
                    log.error("[identity] outbox 事件连续 {} 轮失败，转入死信并放行游标 id={} type={} err={}",
                            failures, event.id(), event.eventType(), e.toString());
                    continue;
                }
                log.warn("[identity] outbox 事件处理失败（第 {}/{} 次），游标停在 {}（下轮重试）"
                                + " id={} type={} err={}",
                        failures, MAX_CONSECUTIVE_FAILURES, lastOk, event.id(), event.eventType(), e.toString());
                break;
            }
        }
        if (lastOk > cursor) writeCursor(lastOk);
        log.info("[identity] outbox 处理 {} 条，游标 {} -> {}", done, cursor, lastOk);
        return done;
    }

    // ── 失败计数 ─────────────────────────────────────────────────────────────

    private int noteFailure(long eventId) {
        if (failingEventId != eventId) {
            failingEventId = eventId;
            consecutiveFailures = 0;
        }
        return ++consecutiveFailures;
    }

    private void clearFailure(long eventId) {
        if (failingEventId == eventId) {
            failingEventId = 0;
            consecutiveFailures = 0;
        }
    }

    // ── 游标 / 死信持久化 ─────────────────────────────────────────────────────

    long readCursor() {
        return configRepo.findByConfigKey(CURSOR_KEY)
                .map(PlatformConfig::getValueJson)
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(value -> {
                    try {
                        return Long.parseLong(value.replace("\"", ""));
                    } catch (NumberFormatException e) {
                        log.warn("[identity] outbox 游标值不是数字，按 0 处理：{}", value);
                        return 0L;
                    }
                })
                .orElse(0L);
    }

    void writeCursor(long value) {
        saveConfig(CURSOR_KEY, String.valueOf(value),
                "统一账号中心 outbox 消费游标（§12.4，由 IdentityOutboxPoller 维护）");
    }

    /**
     * 把一条反复失败的事件记进死信配置（不新建表，运维在「平台配置」里可直接看到）。
     *
     * <p><b>不许带账号标识</b>：这一行落在 {@code aep_platform_configs} 里，
     * 而 {@code /api/config} 是 permitAll 的公开读接口。所以 {@code reason} 只保留
     * 「异常类名 + 脱敏后的短消息」，{@code fromUid} / {@code toUid} / {@code uid} 等
     * 只出现在本地 WARN / ERROR 日志里（见 {@link #pollOnce()}）。
     */
    void parkDeadLetter(IdentityCenterClient.OutboxEvent event, RuntimeException cause) {
        ArrayNode list = readDeadLetters();
        ObjectNode row = MAPPER.createObjectNode();
        row.put("id", event.id());
        row.put("eventType", event.eventType());
        row.put("reason", safeReason(cause));
        row.put("at", Instant.now().toString());
        list.add(row);
        while (list.size() > DEADLETTER_CAP) list.remove(0);
        saveConfig(DEADLETTER_KEY, list.toString(),
                "统一账号中心 outbox 死信（连续失败 " + MAX_CONSECUTIVE_FAILURES + " 轮后转入，需人工处理）");
    }

    /**
     * 死信里可展示的失败原因：{@code 异常类名: 脱敏短消息}。
     *
     * <p>脱敏两步：① 把 {@code xxxUid= / uid= / phone= / mobile= / email= / openId= / unionId=}
     * 后面跟的值换成 {@code ***}；② 把裸 UUID / 长十六进制串换成 {@code ***}
     * （账号中心 uid 就是这个形状，防止它不带字段名地出现在消息里）。
     * 再截断到 {@value #REASON_MAX_CHARS} 字符，避免整行配置被一条长堆栈撑爆。
     */
    static String safeReason(Throwable cause) {
        if (cause == null) return "unknown";
        String type = cause.getClass().getSimpleName();
        String message = cause.getMessage();
        if (message == null || message.isBlank()) return type;
        String scrubbed = SENSITIVE_FIELD.matcher(message).replaceAll("$1=***");
        scrubbed = OPAQUE_ID.matcher(scrubbed).replaceAll("***");
        scrubbed = scrubbed.replaceAll("\\s+", " ").trim();
        if (scrubbed.length() > REASON_MAX_CHARS) {
            scrubbed = scrubbed.substring(0, REASON_MAX_CHARS) + "…";
        }
        return scrubbed.isEmpty() ? type : type + ": " + scrubbed;
    }

    /** {@code fromUid=abc} 这类「字段名=值」——值可能是 uid / 手机号 / 邮箱。 */
    private static final java.util.regex.Pattern SENSITIVE_FIELD = java.util.regex.Pattern.compile(
            "(?i)\\b([a-z0-9_]*uid|user_?id|phone|mobile|email|open_?id|union_?id)\\s*=\\s*[^\\s,;)\\]}]*");

    /** 不带字段名的 uid：UUID，或 16 位以上的十六进制 / 长随机串。 */
    private static final java.util.regex.Pattern OPAQUE_ID = java.util.regex.Pattern.compile(
            "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b"
                    + "|\\b[0-9a-fA-F]{16,}\\b");

    /** 死信 reason 的最大长度（超出截断）。 */
    private static final int REASON_MAX_CHARS = 200;

    ArrayNode readDeadLetters() {
        String raw = configRepo.findByConfigKey(DEADLETTER_KEY)
                .map(PlatformConfig::getValueJson)
                .orElse(null);
        if (raw == null || raw.isBlank()) return MAPPER.createArrayNode();
        try {
            JsonNode parsed = MAPPER.readTree(raw);
            if (parsed instanceof ArrayNode array) return array;
        } catch (Exception e) {
            log.warn("[identity] 死信列表不是合法 JSON 数组，重建：{}", e.toString());
        }
        return MAPPER.createArrayNode();
    }

    private void saveConfig(String key, String valueJson, String description) {
        PlatformConfig row = configRepo.findByConfigKey(key).orElse(null);
        Instant now = Instant.now();
        if (row == null) {
            row = PlatformConfig.builder()
                    .id(UUID.randomUUID().toString())
                    .configKey(key)
                    .valueJson(valueJson)
                    .version(1)
                    .description(description)
                    .updatedAt(now)
                    .updatedBy("system")
                    .build();
        } else {
            row.setValueJson(valueJson);
            row.setVersion(row.getVersion() + 1);
            row.setUpdatedAt(now);
            row.setUpdatedBy("system");
        }
        configRepo.save(row);
    }
}
