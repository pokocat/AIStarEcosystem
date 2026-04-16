package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.dto.PageEnvelope;
import com.aistareco.aep.dto.TenantDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.service.AepUserService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatusCode;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AepUserService userService;

    public AdminUserController(AepUserService userService) {
        this.userService = userService;
    }

    @GetMapping
    public ApiResponse<PageEnvelope<AepUserDto>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String role) {

        AepUser.UserStatus statusEnum = parseEnum(status, AepUser.UserStatus.class, "不支持的用户状态筛选值");
        AepUser.UserRole roleEnum = parseEnum(role, AepUser.UserRole.class, "不支持的用户角色筛选值");
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ApiResponse.of(PageEnvelope.from(userService.list(statusEnum, roleEnum, pageable)));
    }

    @GetMapping("/{id}")
    public ApiResponse<AepUserDto> getById(@PathVariable String id) {
        return ApiResponse.of(userService.findById(id));
    }

    @GetMapping("/{id}/tenants")
    public ApiResponse<List<TenantDto>> listOwnedTenants(@PathVariable String id) {
        return ApiResponse.of(userService.listOwnedTenants(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AepUserDto> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.create(body));
    }

    @PutMapping("/{id}")
    public ApiResponse<AepUserDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.update(id, body));
    }

    @PatchMapping("/{id}")
    public ApiResponse<AepUserDto> patch(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.update(id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        userService.delete(id);
    }

    private <E extends Enum<E>> E parseEnum(String raw, Class<E> type, String errorMessage) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        try {
            return Enum.valueOf(type, raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(org.springframework.http.HttpStatus.BAD_REQUEST, errorMessage);
        }
    }
}
