package com.aistareco.aep.platform;

import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.repository.AuditLogRepository;
import com.aistareco.aep.service.AepUserService;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

/** Management transport only. Original AepUserService owns queries and state transitions. */
@Service
public class UserManagementService {
    private final AepUserService users;
    private final AuditLogRepository audit;
    private final ObjectMapper mapper;
    public UserManagementService(AepUserService users, AuditLogRepository audit, ObjectMapper mapper) {
        this.users = users; this.audit = audit; this.mapper = mapper;
    }

    @Transactional(rollbackFor = Exception.class)
    public Object execute(JsonNode command, String actor) throws Exception {
        String action = command.path("action").asText();
        switch (action) {
            case "users": {
                fields(command, Set.of("action", "page", "size", "q", "status", "kind"));
                int page = integer(command, "page", 0, 0, Integer.MAX_VALUE);
                int size = integer(command, "size", 20, 1, 100);
                return PageEnvelope.from(users.list(enumValue(command, "status", AepUser.UserStatus.class),
                        enumValue(command, "kind", AepUser.AccountKind.class),
                        PageRequest.of(page, size, Sort.by("createdAt").descending()), optional(command, "q", 200)));
            }
            case "user":
                fields(command, Set.of("action", "id"));
                return users.findById(required(command, "id", 160));
            case "userSuspend":
            case "userReactivate": {
                fields(command, Set.of("action", "id", "reason"));
                String id = required(command, "id", 160);
                String reason = "userSuspend".equals(action) ? required(command, "reason", 1000) : optional(command, "reason", 1000);
                var before = users.findById(id);
                var after = "userSuspend".equals(action) ? users.suspend(id) : users.reactivate(id);
                var detail = mapper.createObjectNode();
                detail.put("beforeStatus", before.status()); detail.put("afterStatus", after.status());
                detail.put("reason", reason == null ? "" : reason);
                audit.save(AuditLog.builder().id(UUID.randomUUID().toString()).userId(actor).username(actor)
                        .action("userSuspend".equals(action) ? AuditService.Actions.ADMIN_USER_SUSPEND : AuditService.Actions.ADMIN_USER_REACTIVATE)
                        .resourceType("aep_user").resourceId(id).appCode("platform-console")
                        .result(AuditLog.AuditResult.SUCCESS).detail(mapper.writeValueAsString(detail)).createdAt(Instant.now()).build());
                return after;
            }
            default: throw invalid();
        }
    }
    private static void fields(JsonNode node, Set<String> allowed) {
        if (!node.isObject()) throw invalid();
        node.fieldNames().forEachRemaining(key -> { if (!allowed.contains(key)) throw invalid(); });
    }
    private static int integer(JsonNode node, String key, int fallback, int min, int max) {
        if (!node.has(key)) return fallback;
        var value = node.get(key);
        if (!value.isIntegralNumber() || !value.canConvertToInt() || value.intValue() < min || value.intValue() > max) throw invalid();
        return value.intValue();
    }
    private static String optional(JsonNode node, String key, int max) {
        if (!node.has(key)) return null;
        if (!node.get(key).isTextual() || node.get(key).asText().length() > max) throw invalid();
        return node.get(key).asText().trim();
    }
    private static String required(JsonNode node, String key, int max) {
        String value = optional(node, key, max);
        if (value == null || value.isBlank()) throw invalid();
        return value;
    }
    private static <T extends Enum<T>> T enumValue(JsonNode node, String key, Class<T> type) {
        String value = optional(node, key, 30);
        if (value == null) return null;
        try { return Enum.valueOf(type, value.toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException error) { throw invalid(); }
    }
    private static BusinessException invalid() { return BusinessException.badRequest("USER_MANAGEMENT_COMMAND_INVALID", "用户管理参数无效"); }
}
