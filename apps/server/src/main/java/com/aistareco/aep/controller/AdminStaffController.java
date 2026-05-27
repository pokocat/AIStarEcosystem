package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminUserDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.model.AdminUser;
import com.aistareco.aep.repository.AdminUserRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * CRUD management for platform admin staff (管理员账号).
 * Only SUPER_ADMIN can create/modify other admin accounts.
 */
@RestController
@RequestMapping("/api/admin/staff")
@org.springframework.security.access.prepost.PreAuthorize("@accountSourceResolver.isAdmin(authentication)")
public class AdminStaffController {

    private final AdminUserRepository adminUserRepo;
    private final PasswordEncoder passwordEncoder;

    public AdminStaffController(AdminUserRepository adminUserRepo, PasswordEncoder passwordEncoder) {
        this.adminUserRepo = adminUserRepo;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping
    public PageEnvelope<AdminUserDto> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<AdminUserDto> result = adminUserRepo.findAll(pageable).map(AdminUserDto::from);
        return PageEnvelope.from(result);
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminUserDto> getById(@PathVariable String id) {
        return ApiResponse.of(adminUserRepo.findById(id)
                .map(AdminUserDto::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "管理员账号不存在")));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AdminUserDto> create(@RequestBody Map<String, Object> body) {
        String username = getString(body, "username");
        if (username == null || username.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "用户名不能为空");
        }
        if (adminUserRepo.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在");
        }
        String rawPassword = getString(body, "password");
        if (rawPassword == null || rawPassword.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "密码不能为空");
        }

        Instant now = Instant.now();
        AdminUser admin = AdminUser.builder()
                .id(UUID.randomUUID().toString())
                .username(username)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .email(getString(body, "email"))
                .displayName(getString(body, "displayName"))
                .role(parseRole(getString(body, "role"), AdminUser.AdminRole.OPERATOR))
                .status(AdminUser.AdminStatus.ACTIVE)
                .createdAt(now)
                .updatedAt(now)
                .build();

        return ApiResponse.of(AdminUserDto.from(adminUserRepo.save(admin)));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminUserDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        AdminUser admin = adminUserRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "管理员账号不存在"));

        if (body.containsKey("displayName")) admin.setDisplayName(getString(body, "displayName"));
        if (body.containsKey("email")) admin.setEmail(getString(body, "email"));
        if (body.containsKey("role")) admin.setRole(parseRole(getString(body, "role"), admin.getRole()));
        if (body.containsKey("status")) {
            try {
                admin.setStatus(AdminUser.AdminStatus.valueOf(getString(body, "status").toUpperCase()));
            } catch (IllegalArgumentException e) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的账号状态值");
            }
        }
        if (body.containsKey("password")) {
            String raw = getString(body, "password");
            if (raw != null && !raw.isBlank()) {
                admin.setPasswordHash(passwordEncoder.encode(raw));
            }
        }
        admin.setUpdatedAt(Instant.now());
        return ApiResponse.of(AdminUserDto.from(adminUserRepo.save(admin)));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        if (!adminUserRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "管理员账号不存在");
        }
        adminUserRepo.deleteById(id);
    }

    private String getString(Map<String, Object> body, String key) {
        Object val = body.get(key);
        return val != null ? val.toString() : null;
    }

    private AdminUser.AdminRole parseRole(String raw, AdminUser.AdminRole defaultRole) {
        if (raw == null || raw.isBlank()) return defaultRole;
        try {
            return AdminUser.AdminRole.valueOf(raw.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的管理员角色值: " + raw);
        }
    }
}
