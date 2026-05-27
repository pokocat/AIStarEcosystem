package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.AdminUserDto;
import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.repository.AdminUserRepository;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Authentication for platform admin staff (管理员登录).
 * Uses AdminUser table — completely separate from platform end-users (AepUser).
 */
@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {

    private final AdminUserRepository adminUserRepo;
    private final AepUserRepository aepUserRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AdminAuthController(AdminUserRepository adminUserRepo,
                                AepUserRepository aepUserRepo,
                                PasswordEncoder passwordEncoder,
                                JwtUtil jwtUtil) {
        this.adminUserRepo = adminUserRepo;
        this.aepUserRepo = aepUserRepo;
        this.passwordEncoder = passwordEncoder;
        this.jwtUtil = jwtUtil;
    }

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (username == null || password == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名和密码不能为空");
        }

        AdminUser admin = adminUserRepo.findByUsername(username)
                .or(() -> adminUserRepo.findByEmail(username))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误"));

        if (admin.getPasswordHash() == null || !passwordEncoder.matches(password, admin.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误");
        }

        if (admin.getStatus() != AdminUser.AdminStatus.ACTIVE) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "该账户已被停用");
        }

        admin.setLastLoginAt(java.time.Instant.now());
        adminUserRepo.save(admin);

        String token = jwtUtil.generateToken(admin.getId(), admin.getUsername(), admin.getRole().name());

        return ApiResponse.of(Map.of(
                "token", token,
                "user", AdminUserDto.from(admin)
        ));
    }

    /**
     * v0.37：me 端点同时支持 admin_users（原管理员）和 aep_users + operatorRole（平台运营登录）。
     * principal.getName() 是登录时 JWT subject (= user id)，先查 admin_users，未命中再查 aep_users。
     * 返回统一的 wire shape：{id, username, email, displayName, role, status}，role 用 JWT.role claim 对齐。
     */
    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me(Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        String id = principal.getName();
        AdminUser admin = adminUserRepo.findById(id).orElse(null);
        if (admin != null) {
            Map<String, Object> body = new HashMap<>();
            AdminUserDto dto = AdminUserDto.from(admin);
            body.put("id", dto.id());
            body.put("username", dto.username());
            body.put("email", dto.email());
            body.put("displayName", dto.displayName());
            body.put("role", dto.role());
            body.put("status", dto.status());
            // v0.37+：账号来源 —— 前端按此隐藏「秘钥批次 / 管理员账号」等仅 admin 可见菜单。
            body.put("accountSource", "admin");
            return ApiResponse.of(body);
        }
        AepUser aep = aepUserRepo.findById(id).orElse(null);
        if (aep != null && aep.getOperatorRole() != null) {
            Map<String, Object> body = new HashMap<>();
            body.put("id", aep.getId());
            body.put("username", aep.getUsername());
            body.put("email", aep.getEmail());
            body.put("displayName", aep.getDisplayName());
            body.put("role", aep.getOperatorRole().name().toLowerCase(Locale.ROOT));
            body.put("status", aep.getStatus() != null ? aep.getStatus().name().toLowerCase(Locale.ROOT) : "active");
            body.put("accountSource", "operator");
            return ApiResponse.of(body);
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "管理员账号不存在");
    }
}
