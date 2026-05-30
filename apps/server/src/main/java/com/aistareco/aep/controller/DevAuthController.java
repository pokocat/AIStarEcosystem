package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.MeDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.model.Studio;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.repository.StudioRepository;
import com.aistareco.common.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 仅在 {@code dev} profile 下启用的开发期登录入口。
 * <ul>
 *   <li>{@code GET  /api/auth/dev-accounts} — 返回可选账号列表（带 studio 概要），用于登录页下拉。</li>
 *   <li>{@code POST /api/auth/dev-login} — 按 username 直接签发 JWT（无密码），用于演示/联调。</li>
 * </ul>
 * 默认关闭，可通过 {@code aep.dev-auth.enabled=true} 临时打开。
 */
@RestController
@RequestMapping("/api/auth")
@ConditionalOnProperty(prefix = "aep.dev-auth", name = "enabled", havingValue = "true")
public class DevAuthController {

    private static final Logger log = LoggerFactory.getLogger(DevAuthController.class);

    private final AepUserRepository userRepo;
    private final StudioRepository studioRepo;
    private final JwtUtil jwtUtil;

    public DevAuthController(AepUserRepository userRepo,
                              StudioRepository studioRepo,
                              JwtUtil jwtUtil) {
        this.userRepo = userRepo;
        this.studioRepo = studioRepo;
        this.jwtUtil = jwtUtil;
    }

    /** 可选账号列表（包含 studio 概要），前端登录页直接渲染。 */
    @GetMapping("/dev-accounts")
    public ApiResponse<List<Map<String, Object>>> listDevAccounts() {
        List<Map<String, Object>> rows = userRepo.findAll().stream()
                .filter(u -> u.getKind() == AepUser.AccountKind.STUDIO)
                .filter(u -> u.getStatus() == AepUser.UserStatus.ACTIVE)
                .sorted((a, b) -> a.getUsername().compareTo(b.getUsername()))
                .map(u -> {
                    Studio s = studioRepo.findByOwnerUserId(u.getId()).orElse(null);
                    return Map.<String, Object>of(
                            "username", u.getUsername(),
                            "displayName", u.getDisplayName() == null ? u.getUsername() : u.getDisplayName(),
                            "studioName", s == null ? "" : s.getName(),
                            "studioKind", s == null ? "" : s.getKind().name().toLowerCase()
                    );
                })
                .toList();
        return ApiResponse.of(rows);
    }

    /**
     * 开发期免密登录。
     * body 形如 {@code { "username": "studio_starlight" }}；username 为空时选第一位 STUDIO 账号。
     * 返回 {@code { token, user: MeDto }}。
     */
    @PostMapping("/dev-login")
    public ApiResponse<Map<String, Object>> devLogin(@RequestBody(required = false) Map<String, String> body) {
        String username = body == null ? null : body.get("username");

        AepUser user = (username == null || username.isBlank())
                ? pickDefaultStudioUser()
                : userRepo.findByUsername(username.trim())
                    .orElseThrow(() -> {
                        log.warn("[dev-login] miss username={}", username.trim());
                        return new ResponseStatusException(HttpStatus.NOT_FOUND, "账号不存在: " + username);
                    });

        if (user.getStatus() != AepUser.UserStatus.ACTIVE) {
            log.warn("[dev-login] inactive userId={} username={} status={}",
                    user.getId(), user.getUsername(), user.getStatus());
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该账户已被停用");
        }

        user.setLastLoginAt(Instant.now());
        userRepo.save(user);

        // v0.31+: operatorRole 非空时优先用它（OPERATOR / SUPER_ADMIN），让该账号
        // 通过 /api/admin/** 门禁；否则回退到 kind 派生的 USER / STUDIO。
        String role = user.getOperatorRole() != null
                ? user.getOperatorRole().name()
                : (user.getKind() == AepUser.AccountKind.STUDIO ? "STUDIO" : "USER");
        String token = jwtUtil.generateToken(user.getId(), user.getUsername(), role);
        Studio studio = studioRepo.findByOwnerUserId(user.getId()).orElse(null);
        log.info("[dev-login] success userId={} username={} role={} studioId={}",
                user.getId(), user.getUsername(), role, studio == null ? null : studio.getId());

        return ApiResponse.of(Map.of(
                "token", token,
                "user", MeDto.from(user, studio)
        ));
    }

    private AepUser pickDefaultStudioUser() {
        return userRepo.findAll().stream()
                .filter(u -> u.getKind() == AepUser.AccountKind.STUDIO)
                .filter(u -> u.getStatus() == AepUser.UserStatus.ACTIVE)
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "dev 环境尚未种子任何 STUDIO 账户"));
    }
}
