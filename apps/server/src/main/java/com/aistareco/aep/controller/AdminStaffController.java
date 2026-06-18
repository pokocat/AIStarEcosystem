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

import java.security.Principal;
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
    public ApiResponse<AdminUserDto> update(@PathVariable String id, @RequestBody Map<String, Object> body,
                                            Principal principal) {
        AdminUser admin = adminUserRepo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "管理员账号不存在"));

        // self-protect: 不能改自己的角色 / 账号状态（避免锁死自己或自我提权），
        // 但允许本人改自己的昵称 / 邮箱 / 密码。变更需由其它超管处理。
        boolean isSelf = principal != null && id.equals(principal.getName());
        if (isSelf && body.containsKey("role")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能修改自己的角色（请让其它超管处理）");
        }
        if (isSelf && body.containsKey("status")) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能修改自己的账号状态（请让其它超管处理）");
        }

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
    public void delete(@PathVariable String id, Principal principal) {
        if (principal != null && id.equals(principal.getName())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能删除自己的账号（请让其它超管处理）");
        }
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
