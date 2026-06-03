package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.AdminAuthUserDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.AuditService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

/**
 * v0.37：Plan B —— admin 后台「平台运营」独立登录通道。
 *
 * 设计动机：用户希望 celebrity operator 既在 web-celebrity 内嵌写权限，
 * 又能登 admin 后台做运营工作。但 {@link AdminAuthController} 严格只查
 * {@code admin_users} 表（双账号体系核心约束，见 AepUser.java L53-58）。
 *
 * 本控制器是 AepUser + operatorRole 体系的独立登录通道：
 *   - 端点：POST /api/admin/auth/operator-login
 *   - 校验：username/password → operatorRole 必须非 null
 *   - JWT.role 用 operatorRole.name()（OPERATOR / SUPER_ADMIN），可通过
 *     AepSecurityConfig.hasAnyRole 门禁
 *   - 两套账号、两套表、共享 JWT role claim、互不污染
 *
 * 安全要求：
 *   - 失败 / 成功落审计日志（event_type=admin.operator_login.{success|fail}）
 *   - rate-limit 未在本期实现（v0.38+ 候选）
 */
@RestController
@RequestMapping("/api/admin/auth")
public class AepOperatorAuthController {

    private static final Logger log = LoggerFactory.getLogger(AepOperatorAuthController.class);

    private final AepUserRepository aepUserRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditService auditService;

    public AepOperatorAuthController(AepUserRepository aepUserRepo,
                                      PasswordEncoder passwordEncoder,
                                      JwtUtil jwtUtil,
                                      AuditService auditService) {
        this.aepUserRepo = aepUserRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.auditService = auditService;
    }

    @PostMapping("/operator-login")
    public ApiResponse<Map<String, Object>> operatorLogin(@RequestBody Map<String, String> body,
                                                           HttpServletRequest request) {
        String username = body == null ? null : body.get("username");
        String password = body == null ? null : body.get("password");

        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            auditService.recordAuthFailure(AuditService.Actions.OPERATOR_LOGIN, username,
                    "ADMIN_LOGIN_REQUIRED", "用户名或密码字段缺失", request);
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ADMIN_LOGIN_REQUIRED", "用户名和密码不能为空");
        }

        String loginName = username.trim();
        AepUser user = aepUserRepo.findByUsername(loginName).orElse(null);
        if (user == null) {
            log.warn("[operator-login] miss username={}", loginName);
            auditService.recordAuthFailure(AuditService.Actions.OPERATOR_LOGIN, loginName,
                    "ADMIN_CREDENTIALS_INVALID", "账号不存在", request);
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "ADMIN_CREDENTIALS_INVALID", "用户名或密码错误");
        }

        // operator 必须有 operatorRole 才能登 admin 后台
        if (user.getOperatorRole() == null) {
            log.warn("[operator-login] no operatorRole username={} userId={}", loginName, user.getId());
            auditService.recordAuth(AuditService.Actions.OPERATOR_LOGIN, AuditLog.AuditResult.FAILURE,
                    user.getId(), user.getUsername(),
                    "ADMIN_OPERATOR_ROLE_REQUIRED", "该账号无平台运营权限", request);
            throw new BusinessException(HttpStatus.FORBIDDEN, "ADMIN_OPERATOR_ROLE_REQUIRED", "该账号无平台运营权限");
        }

        // 必须设过 passwordHash —— v0.37 起 DataInitializer 会给 celebrity_operator 落默认密码
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            log.warn("[operator-login] no passwordHash userId={}", user.getId());
            auditService.recordAuth(AuditService.Actions.OPERATOR_LOGIN, AuditLog.AuditResult.FAILURE,
                    user.getId(), user.getUsername(),
                    "ADMIN_PASSWORD_NOT_SET", "该账号未设置密码", request);
            throw new BusinessException(HttpStatus.FORBIDDEN, "ADMIN_PASSWORD_NOT_SET",
                    "该账号未设置密码，请联系超级管理员通过 /admin/aep-users/{id}/set-password 设置");
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            log.warn("[operator-login] bad password userId={}", user.getId());
            auditService.recordAuth(AuditService.Actions.OPERATOR_LOGIN, AuditLog.AuditResult.FAILURE,
                    user.getId(), user.getUsername(),
                    "ADMIN_CREDENTIALS_INVALID", "密码错误", request);
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "ADMIN_CREDENTIALS_INVALID", "用户名或密码错误");
        }

        if (user.getStatus() != AepUser.UserStatus.ACTIVE) {
            auditService.recordAuth(AuditService.Actions.OPERATOR_LOGIN, AuditLog.AuditResult.FAILURE,
                    user.getId(), user.getUsername(),
                    "ADMIN_ACCOUNT_DISABLED", "账号被停用 status=" + user.getStatus(), request);
            throw new BusinessException(HttpStatus.FORBIDDEN, "ADMIN_ACCOUNT_DISABLED", "该账户已被停用");
        }

        user.setLastLoginAt(Instant.now());
        aepUserRepo.save(user);

        // JWT.role = operatorRole.name() —— OPERATOR / SUPER_ADMIN，可通过 AepSecurityConfig.hasAnyRole 门禁
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(),
                user.getOperatorRole().name());

        log.info("[operator-login] success userId={} role={}", user.getId(), user.getOperatorRole());
        auditService.recordAuthSuccess(AuditService.Actions.OPERATOR_LOGIN, user.getId(), user.getUsername(),
                "运营账号登录成功 operatorRole=" + user.getOperatorRole(), request);
        return ApiResponse.of(Map.of(
                "token", token,
                "user", AdminAuthUserDto.fromOperator(user)
        ));
    }
}
