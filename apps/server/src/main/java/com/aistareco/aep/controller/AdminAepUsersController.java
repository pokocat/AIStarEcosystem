package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * v0.31+ admin 端：管理 AepUser 表的内嵌运营角色（operatorRole）。
 *
 * 用于 admin 后台的「平台运营 · celebrity」管理页：列出 aep_users + 切换某账号
 * 的 operatorRole 字段值。
 *
 * Security：自动继承 AepSecurityConfig 的 /api/admin/** → hasAnyRole(SUPER_ADMIN,
 * OPERATOR) 门禁。**OPERATOR 也能改其他人的 operatorRole** —— 如果将来需要限制
 * 只有 SUPER_ADMIN 才能授权，需要在 PATCH 上加 @PreAuthorize("hasRole('SUPER_ADMIN')")。
 */
@RestController
@RequestMapping("/api/admin/aep-users")
public class AdminAepUsersController {

    private final AepUserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    public AdminAepUsersController(AepUserRepository userRepo,
                                    PasswordEncoder passwordEncoder) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 列出全部 aep_users（不分页 —— 当前规模 < 100；规模上来后再加 pageable）。
     * 支持简单过滤：
     *   - q             模糊匹配 username / displayName / phone / email（不区分大小写）
     *   - hasOperator   true → 仅 operatorRole 非空；false → 仅 operatorRole 为空；null → 全部
     */
    @GetMapping
    public ApiResponse<List<AepUserDto>> list(@RequestParam(required = false) String q,
                                              @RequestParam(required = false) Boolean hasOperator) {
        String needle = q == null ? null : q.trim().toLowerCase(Locale.ROOT);
        List<AepUserDto> rows = userRepo.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream()
                .filter(u -> {
                    if (Boolean.TRUE.equals(hasOperator) && u.getOperatorRole() == null) return false;
                    if (Boolean.FALSE.equals(hasOperator) && u.getOperatorRole() != null) return false;
                    if (needle == null || needle.isEmpty()) return true;
                    return contains(u.getUsername(), needle)
                            || contains(u.getDisplayName(), needle)
                            || contains(u.getPhone(), needle)
                            || contains(u.getEmail(), needle);
                })
                .map(AepUserDto::from)
                .toList();
        return ApiResponse.of(rows);
    }

    /** 改某账号的 operatorRole。 */
    @PatchMapping("/{id}/operator-role")
    @Transactional
    public ApiResponse<AepUserDto> updateOperatorRole(@PathVariable String id,
                                                      @RequestBody Map<String, String> body,
                                                      Principal principal) {
        AepUser user = userRepo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "用户不存在"));
        // v0.37 self-protect：不允许把自己降级 / 改成 null（防止 OPERATOR 误操作锁死自己）
        if (principal != null && id.equals(principal.getName())) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OPERATOR_SELF_MODIFY",
                    "不能修改自己的 operatorRole（请让其他超管处理）");
        }
        String raw = body == null ? null : body.get("operatorRole");
        user.setOperatorRole(parseOperatorRole(raw));
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
        return ApiResponse.of(AepUserDto.from(user));
    }

    /**
     * v0.37：超级管理员给 AepUser 设/重置密码。
     * 用途：让 celebrity operator / SUPER_ADMIN 能用密码登 admin 后台
     * （走 /api/admin/auth/operator-login）。
     */
    @PostMapping("/{id}/set-password")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @Transactional
    public ApiResponse<Map<String, Object>> setPassword(@PathVariable String id,
                                                         @RequestBody Map<String, String> body) {
        String password = body == null ? null : body.get("password");
        if (password == null || password.length() < 6) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PASSWORD_TOO_SHORT",
                    "密码至少 6 位");
        }
        AepUser user = userRepo.findById(id)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND", "用户不存在"));
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setUpdatedAt(Instant.now());
        userRepo.save(user);
        return ApiResponse.of(Map.of("ok", true, "userId", user.getId()));
    }

    private static AepUser.OperatorRole parseOperatorRole(String raw) {
        if (raw == null || raw.isBlank() || "null".equalsIgnoreCase(raw)) return null;
        String upper = raw.trim().toUpperCase(Locale.ROOT);
        try {
            return AepUser.OperatorRole.valueOf(upper);
        } catch (IllegalArgumentException e) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "OPERATOR_ROLE_INVALID",
                    "operatorRole 必须是 OPERATOR / SUPER_ADMIN / null");
        }
    }

    private static boolean contains(String haystack, String needle) {
        return haystack != null && haystack.toLowerCase(Locale.ROOT).contains(needle);
    }
}
