package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.LedgerEntryDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.WalletDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.service.AepUserService;
import com.aistareco.aep.service.AuditService;
import com.aistareco.aep.service.CreditService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AepUserService userService;
    private final CreditService creditService;
    private final AuditService auditService;

    public AdminUserController(AepUserService userService,
                                CreditService creditService,
                                AuditService auditService) {
        this.userService = userService;
        this.creditService = creditService;
        this.auditService = auditService;
    }

    @GetMapping
    public PageEnvelope<AepUserDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String kind) {

        AepUser.UserStatus statusEnum = parseEnum(status, AepUser.UserStatus.class, "不支持的用户状态筛选值");
        AepUser.AccountKind kindEnum = parseEnum(kind, AepUser.AccountKind.class, "不支持的账号类型筛选值");
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return PageEnvelope.from(userService.list(statusEnum, kindEnum, pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<AepUserDto> getById(@PathVariable String id) {
        return ApiResponse.of(userService.findById(id));
    }

    @GetMapping("/{id}/wallet")
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')") // 钱包属资金面，OPERATOR 不可读（同 AdminCreditController 口径）
    public ApiResponse<WalletDto> getWallet(@PathVariable String id) {
        return ApiResponse.of(creditService.findWalletByUserId(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AepUserDto> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.create(body));
    }

    @PutMapping("/{id}")
    public ApiResponse<AepUserDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.update(id, body));
    }

    @PatchMapping("/{id}")
    public ApiResponse<AepUserDto> patch(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.update(id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        userService.delete(id);
    }

    /**
     * v0.59：停用账号（仅 ACTIVE 可停用）。reason 必填，写入审计日志（admin.user.suspend）。
     * 停用后该用户的密码 / 短信 / dev 登录均被拒（ACCOUNT_DISABLED）。
     */
    @PostMapping("/{id}/suspend")
    public ApiResponse<AepUserDto> suspend(@PathVariable String id,
                                           @RequestBody(required = false) StatusActionRequest body,
                                           HttpServletRequest request) {
        String reason = body == null ? null : body.reason();
        if (reason == null || reason.isBlank()) {
            throw BusinessException.badRequest("SUSPEND_REASON_REQUIRED", "请填写停用原因");
        }
        AepUserDto dto = userService.suspend(id);
        auditService.recordAdminAction(AuditService.Actions.ADMIN_USER_SUSPEND, "aep_user", id,
                "停用账号 @" + dto.username() + "：" + reason.trim(), request);
        return ApiResponse.of(dto);
    }

    /** v0.59：恢复已停用账号（仅 SUSPENDED 可恢复）。reason 选填，写入审计日志。 */
    @PostMapping("/{id}/reactivate")
    public ApiResponse<AepUserDto> reactivate(@PathVariable String id,
                                              @RequestBody(required = false) StatusActionRequest body,
                                              HttpServletRequest request) {
        String reason = body == null ? null : body.reason();
        AepUserDto dto = userService.reactivate(id);
        auditService.recordAdminAction(AuditService.Actions.ADMIN_USER_REACTIVATE, "aep_user", id,
                "恢复账号 @" + dto.username() + (reason == null || reason.isBlank() ? "" : "：" + reason.trim()),
                request);
        return ApiResponse.of(dto);
    }

    public record StatusActionRequest(String reason) {}

    /**
     * Manually adjust credit balance for a platform user (运营调差).
     * Body: { "amount": 100, "description": "补偿调整" }
     * Positive amount = credit (记 gift); negative = debit（gift→license→recharge，可触达资金面）。
     *
     * 钱包属资金面，口径同上方 getWallet：限 FINANCE_ADMIN / SUPER_ADMIN，OPERATOR 不可访问
     * （此前遗漏 @PreAuthorize，落到 /api/admin/** 的 SUPER_ADMIN|OPERATOR 兜底——任意 OPERATOR
     * admin 可无审批地任意加/扣任意用户余额，包括扣穿到 rechargeBalance 这个资金面桶，与
     * `AdminCreditOpsController`（运营调差/赠送，只碰 giftBalance + maker-checker 大额审批）
     * 刻意设计的治理口径矛盾）。
     */
    @PostMapping("/{id}/credits/adjust")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('FINANCE_ADMIN','SUPER_ADMIN')")
    public ApiResponse<LedgerEntryDto> adjustCredits(@PathVariable String id,
                                                      @RequestBody Map<String, Object> body) {
        return ApiResponse.of(creditService.adjustUserCredits(id, body));
    }

    private <E extends Enum<E>> E parseEnum(String raw, Class<E> type, String errorMessage) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, errorMessage);
        }
    }
}
