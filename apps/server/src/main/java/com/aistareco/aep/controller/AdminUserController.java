package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.security.AdminPrincipal;
import com.aistareco.aep.service.AdminAuditRecorder;
import com.aistareco.aep.service.AepUserService;
import com.aistareco.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AepUserService userService;
    private final AdminAuditRecorder auditRecorder;

    public AdminUserController(AepUserService userService, AdminAuditRecorder auditRecorder) {
        this.userService = userService;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping
    public ApiResponse<Page<AepUserDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role) {

        AepUser.UserStatus statusEnum = status != null ? AepUser.UserStatus.valueOf(status) : null;
        AepUser.UserRole roleEnum = role != null ? AepUser.UserRole.valueOf(role) : null;
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(userService.list(statusEnum, roleEnum, pageable));
    }

    @GetMapping("/{id}")
    public ApiResponse<AepUserDto> getById(@PathVariable String id) {
        return ApiResponse.of(userService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AepUserDto> create(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        AepUserDto user = userService.create(body);
        auditRecorder.success(principal, request, "user.create", "user", user.id(), "创建用户");
        return ApiResponse.of(user);
    }

    @PutMapping("/{id}")
    public ApiResponse<AepUserDto> update(
            @PathVariable String id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        AepUserDto user = userService.update(id, body);
        auditRecorder.success(principal, request, "user.update", "user", id, "更新用户");
        return ApiResponse.of(user);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable String id,
            @AuthenticationPrincipal AdminPrincipal principal,
            HttpServletRequest request
    ) {
        userService.delete(id);
        auditRecorder.success(principal, request, "user.delete", "user", id, "删除用户");
    }
}
