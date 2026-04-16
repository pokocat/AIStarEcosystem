package com.aistareco.aep.controller;

import com.aistareco.aep.config.JwtUtil;
import com.aistareco.aep.dto.AdminUserDto;
import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.repository.AdminUserRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.Map;

/**
 * Authentication for platform admin staff (管理员登录).
 * Uses AdminUser table — completely separate from platform end-users (AepUser).
 */
@RestController
@RequestMapping("/api/admin/auth")
public class AdminAuthController {

    private final AdminUserRepository adminUserRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public AdminAuthController(AdminUserRepository adminUserRepo,
                                PasswordEncoder passwordEncoder,
                                JwtUtil jwtUtil) {
        this.adminUserRepo = adminUserRepo;
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

    @GetMapping("/me")
    public ApiResponse<AdminUserDto> me(Principal principal) {
        if (principal == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "未登录");
        }
        AdminUser admin = adminUserRepo.findById(principal.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "管理员账号不存在"));
        return ApiResponse.of(AdminUserDto.from(admin));
    }
}
