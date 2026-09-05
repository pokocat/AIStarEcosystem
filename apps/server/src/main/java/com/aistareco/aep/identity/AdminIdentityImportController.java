package com.aistareco.aep.identity;

import com.aistareco.common.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 老用户导入的运维入口（{@code docs/unified-identity-plan.md} §12.3）。
 *
 * <pre>
 * POST /api/admin/identity/import      （SUPER_ADMIN）
 *   body {"batchSize": 200, "dryRun": false}    两个字段都可选
 *   200  {"success":true,"data":{"scanned":N,"linked":N,"created":N,"skipped":N,"errors":N}}
 *   503  IDENTITY_NOT_CONFIGURED（账号中心未配置）
 * </pre>
 *
 * 幂等，可重复调用：已经有 {@code identity_uid} 的账号不进候选集。
 */
@RestController
@RequestMapping("/api/admin/identity")
public class AdminIdentityImportController {

    private final IdentityImportService importService;

    public AdminIdentityImportController(IdentityImportService importService) {
        this.importService = importService;
    }

    @PostMapping("/import")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ApiResponse<IdentityImportService.ImportReport> importUsers(
            @RequestBody(required = false) Map<String, Object> body) {
        Integer batchSize = body == null ? null : asInt(body.get("batchSize"));
        boolean dryRun = body != null && Boolean.TRUE.equals(asBool(body.get("dryRun")));
        return ApiResponse.of(importService.run(batchSize, dryRun));
    }

    private static Integer asInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        if (value instanceof String s && !s.isBlank()) {
            try { return Integer.parseInt(s.trim()); } catch (NumberFormatException ignored) { return null; }
        }
        return null;
    }

    private static Boolean asBool(Object value) {
        if (value instanceof Boolean b) return b;
        if (value instanceof String s) return Boolean.parseBoolean(s.trim());
        return null;
    }
}
