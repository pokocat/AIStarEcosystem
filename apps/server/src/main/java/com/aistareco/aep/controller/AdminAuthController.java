package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.AdminAuthUserDto;
import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.AuditLog;
import com.aistareco.aep.repository.AdminUserRepository;
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

import java.security.Principal;
import java.util.Map;

/**
 * Authentication for platform admin staff (管理员登录).
 * Uses AdminUser table — completely separate from platform end-users (AepUser).
 */
@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthController.class);

    private final AdminUserRepository adminUserRepo;
    private final AepUserRepository aepUserRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuditService auditService;

    public AdminAuthController(AdminUserRepository adminUserRepo,
                                AepUserRepository aepUserRepo,
                                PasswordEncoder passwordEncoder,
                                JwtUtil jwtUtil,
                                AuditService auditService) {
        this.adminUserRepo = adminUserRepo;
        this.aepUserRepo = aepUserRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
        this.auditService = auditService;
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> body,
                                                   HttpServletRequest request) {
        String username = body == null ? null : body.get("username");
        String password = body == null ? null : body.get("password");

        if (username == null || password == null) {
            log.warn("[admin-login] rejected missing-field usernamePresent={} passwordPresent={}",
                    username != null, password != null);
            auditService.recordAuthFailure(AuditService.Actions.ADMIN_LOGIN, username,
                    "ADMIN_LOGIN_REQUIRED", "用户名或密码字段缺失", request);
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ADMIN_LOGIN_REQUIRED", "用户名和密码不能为空");
        }

        String loginName = username.trim();
        AdminUser admin = adminUserRepo.findByUsername(loginName)
                .or(() -> adminUserRepo.findByEmail(loginName))
                .orElse(null);
        if (admin == null) {
            log.warn("[admin-login] miss username={}", loginName);
            auditService.recordAuthFailure(AuditService.Actions.ADMIN_LOGIN, loginName,
                    "ADMIN_CREDENTIALS_INVALID", "账号不存在", request);
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "ADMIN_CREDENTIALS_INVALID", "用户名或密码错误");
        }

        if (admin.getPasswordHash() == null || !passwordEncoder.matches(password, admin.getPasswordHash())) {
            log.warn("[admin-login] bad-password adminId={} username={}", admin.getId(), admin.getUsername());
            auditService.recordAuth(AuditService.Actions.ADMIN_LOGIN, AuditLog.AuditResult.FAILURE,
                    admin.getId(), admin.getUsername(),
                    "ADMIN_CREDENTIALS_INVALID", "密码错误", request);
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "ADMIN_CREDENTIALS_INVALID", "用户名或密码错误");
        }

        if (admin.getStatus() != AdminUser.AdminStatus.ACTIVE) {
            log.warn("[admin-login] inactive adminId={} username={} status={}",
                    admin.getId(), admin.getUsername(), admin.getStatus());
            auditService.recordAuth(AuditService.Actions.ADMIN_LOGIN, AuditLog.AuditResult.FAILURE,
                    admin.getId(), admin.getUsername(),
                    "ADMIN_ACCOUNT_DISABLED", "账号被停用 status=" + admin.getStatus(), request);
            throw new BusinessException(HttpStatus.FORBIDDEN, "ADMIN_ACCOUNT_DISABLED", "该账户已被停用");
        }

        admin.setLastLoginAt(java.time.Instant.now());
        adminUserRepo.save(admin);

        String token = jwtUtil.generateToken(admin.getId(), admin.getUsername(), admin.getRole().name());
        log.info("[admin-login] success adminId={} username={} role={}",
                admin.getId(), admin.getUsername(), admin.getRole());
        auditService.recordAuthSuccess(AuditService.Actions.ADMIN_LOGIN, admin.getId(), admin.getUsername(),
                "admin 后台登录成功 role=" + admin.getRole(), request);

        return ApiResponse.of(Map.of(
                "token", token,
                "user", AdminAuthUserDto.fromAdmin(admin)
        ));
    }

    /**
     * v0.37：me 端点同时支持 admin_users（原管理员）和 aep_users + operatorRole（平台运营登录）。
     * principal.getName() 是登录时 JWT subject (= user id)，先查 admin_users，未命中再查 aep_users。
     * 返回统一的 wire shape：{id, username, email, displayName, role, status}，role 用 JWT.role claim 对齐。
     */
    @GetMapping("/me")
    public ApiResponse<AdminAuthUserDto> me(Principal principal) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "ADMIN_UNAUTHENTICATED", "未登录");
        }
        String id = principal.getName();
        AdminUser admin = adminUserRepo.findById(id).orElse(null);
        if (admin != null) {
            return ApiResponse.of(AdminAuthUserDto.fromAdmin(admin));
        }
        AepUser aep = aepUserRepo.findById(id).orElse(null);
        if (aep != null && aep.getOperatorRole() != null) {
            return ApiResponse.of(AdminAuthUserDto.fromOperator(aep));
        }
        throw new BusinessException(HttpStatus.NOT_FOUND, "ADMIN_ACCOUNT_NOT_FOUND", "管理员账号不存在");
    }

    @PostMapping("/change-password")
    public ApiResponse<Map<String, Object>> changePassword(Principal principal,
                                                           @RequestBody Map<String, String> body,
                                                           HttpServletRequest request) {
        if (principal == null) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "ADMIN_UNAUTHENTICATED", "未登录");
        }
        String currentPassword = body == null ? null : body.get("currentPassword");
        String newPassword = body == null ? null : body.get("newPassword");
        if (currentPassword == null || currentPassword.isBlank()
                || newPassword == null || newPassword.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ADMIN_PASSWORD_REQUIRED", "当前密码和新密码不能为空");
        }
        if (newPassword.length() < 6) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ADMIN_PASSWORD_TOO_SHORT", "新密码至少 6 位");
        }
        if (currentPassword.equals(newPassword)) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ADMIN_PASSWORD_UNCHANGED", "新密码不能与当前密码相同");
        }

        String id = principal.getName();
        AdminUser admin = adminUserRepo.findById(id).orElse(null);
        if (admin != null) {
            if (admin.getPasswordHash() == null
                    || !passwordEncoder.matches(currentPassword, admin.getPasswordHash())) {
                log.warn("[admin-change-password] bad-current-password adminId={} username={}",
                        admin.getId(), admin.getUsername());
                auditService.recordAuth(AuditService.Actions.ADMIN_CHANGE_PASSWORD,
                        AuditLog.AuditResult.FAILURE, admin.getId(), admin.getUsername(),
                        "ADMIN_CURRENT_PASSWORD_INVALID", "管理员修改密码：当前密码错误", request);
                throw new BusinessException(HttpStatus.FORBIDDEN, "ADMIN_CURRENT_PASSWORD_INVALID", "当前密码错误");
            }
            admin.setPasswordHash(passwordEncoder.encode(newPassword));
            admin.setUpdatedAt(java.time.Instant.now());
            adminUserRepo.save(admin);
            log.info("[admin-change-password] success adminId={} username={}",
                    admin.getId(), admin.getUsername());
            auditService.recordAuthSuccess(AuditService.Actions.ADMIN_CHANGE_PASSWORD,
                    admin.getId(), admin.getUsername(),
                    "管理员修改密码成功（admin_users 体系）", request);
            return ApiResponse.of(Map.of("changed", true, "accountSource", "admin"));
        }

        AepUser aep = aepUserRepo.findById(id).orElse(null);
        if (aep != null && aep.getOperatorRole() != null) {
            if (aep.getPasswordHash() == null
                    || !passwordEncoder.matches(currentPassword, aep.getPasswordHash())) {
                log.warn("[operator-change-password] bad-current-password userId={} username={}",
                        aep.getId(), aep.getUsername());
                auditService.recordAuth(AuditService.Actions.ADMIN_CHANGE_PASSWORD,
                        AuditLog.AuditResult.FAILURE, aep.getId(), aep.getUsername(),
                        "ADMIN_CURRENT_PASSWORD_INVALID", "运营修改密码：当前密码错误", request);
                throw new BusinessException(HttpStatus.FORBIDDEN, "ADMIN_CURRENT_PASSWORD_INVALID", "当前密码错误");
            }
            aep.setPasswordHash(passwordEncoder.encode(newPassword));
            aep.setUpdatedAt(java.time.Instant.now());
            aepUserRepo.save(aep);
            log.info("[operator-change-password] success userId={} username={}",
                    aep.getId(), aep.getUsername());
            auditService.recordAuthSuccess(AuditService.Actions.ADMIN_CHANGE_PASSWORD,
                    aep.getId(), aep.getUsername(),
                    "运营修改密码成功（aep_users.operatorRole 体系）", request);
            return ApiResponse.of(Map.of("changed", true, "accountSource", "operator"));
        }

        throw new BusinessException(HttpStatus.NOT_FOUND, "ADMIN_ACCOUNT_NOT_FOUND", "管理员账号不存在");
    }
}
