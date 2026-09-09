package com.aistareco.aep.identity;

import com.aistareco.common.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
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
 *
 * GET  /api/admin/identity/clients     （SUPER_ADMIN / OPERATOR，只读）
 *   200  {"success":true,"data":{error,configured,issuer,checkedAt,generatedAt,
 *                                activityAvailable,productCount,clientCount,products:[…]}}
 * </pre>
 *
 * 导入是幂等的，可重复调用：已经有 {@code identity_uid} 的账号不进候选集。
 */
@RestController
@RequestMapping("/api/admin/identity")
public class AdminIdentityImportController {

    private final IdentityImportService importService;
    private final IdentityAdminClient adminClient;

    public AdminIdentityImportController(IdentityImportService importService,
                                         IdentityAdminClient adminClient) {
        this.importService = importService;
        this.adminClient = adminClient;
    }

    /**
     * 统一登录接入全景：账号中心注册了哪些客户端、各自还活不活跃。
     *
     * <p>只读，走账号中心的 {@code admin-server} 服务令牌（scope {@code clients.read}）。
     * 读失败 / 未配置<b>不返回错误状态码</b>，而是把 {@code error} 填进 200 的 body ——
     * 这一页的价值就在于把「读不到」和「一个都没接」分开显示，
     * 抛 5xx 会让前端只能笼统地报「加载失败」。
     */
    @GetMapping("/clients")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','OPERATOR')")
    public ApiResponse<IdentityAdminClient.IdentityClientOverview> identityClients() {
        return ApiResponse.of(adminClient.fetchOverview());
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
