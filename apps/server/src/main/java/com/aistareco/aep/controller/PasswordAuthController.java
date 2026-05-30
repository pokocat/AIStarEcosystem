package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.MeDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.Map;

/**
 * 普通用户手机号 + 密码登录。密码由已登录用户在 /api/me/password 设置。
 */
@RestController
@RequestMapping("/api/auth/password")
public class PasswordAuthController {

    private static final Logger log = LoggerFactory.getLogger(PasswordAuthController.class);

    private final AepUserRepository userRepo;
    private final StudioRepository studioRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public PasswordAuthController(AepUserRepository userRepo,
                                  StudioRepository studioRepo,
                                  PasswordEncoder passwordEncoder,
                                  JwtUtil jwtUtil) {
        this.userRepo = userRepo;
        this.studioRepo = studioRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody(required = false) PasswordLoginRequest body) {
        String phone = body == null ? null : body.phone();
        String password = body == null ? null : body.password();
        String trimmedPhone = phone == null ? null : phone.trim();

        if (trimmedPhone == null || trimmedPhone.isBlank() || password == null || password.isBlank()) {
            throw BusinessException.badRequest("PASSWORD_LOGIN_REQUIRED", "手机号和密码不能为空");
        }

        AepUser user = userRepo.findByPhone(trimmedPhone).orElse(null);
        if (user == null) {
            log.warn("[auth-password] user-not-found phone={}", trimmedPhone);
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "PASSWORD_LOGIN_INVALID", "手机号或密码错误");
        }
        if (user.getStatus() != AepUser.UserStatus.ACTIVE) {
            log.warn("[auth-password] inactive userId={} status={}", user.getId(), user.getStatus());
            throw new BusinessException(HttpStatus.FORBIDDEN, "ACCOUNT_DISABLED", "该账户已被停用");
        }
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            log.info("[auth-password] password-not-set phone={} userId={}", trimmedPhone, user.getId());
            throw new BusinessException(HttpStatus.FORBIDDEN, "PASSWORD_NOT_SET",
                    "该账号还未设置密码，请先使用验证码登录后设置密码");
        }
        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            log.warn("[auth-password] bad-password userId={}", user.getId());
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "PASSWORD_LOGIN_INVALID", "手机号或密码错误");
        }

        user.setLastLoginAt(Instant.now());
        userRepo.save(user);

        String role = user.getOperatorRole() != null
                ? user.getOperatorRole().name()
                : (user.getKind() == AepUser.AccountKind.STUDIO ? "STUDIO" : "USER");
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), role);
        Studio studio = studioRepo.findByOwnerUserId(user.getId()).orElse(null);
        log.info("[auth-password] login success phone={} userId={} role={} studioId={}",
                trimmedPhone, user.getId(), role, studio == null ? null : studio.getId());

        return ApiResponse.of(Map.of(
                "token", token,
                "user", MeDto.from(user, studio)
        ));
    }

    public record PasswordLoginRequest(String phone, String password) {}
}
