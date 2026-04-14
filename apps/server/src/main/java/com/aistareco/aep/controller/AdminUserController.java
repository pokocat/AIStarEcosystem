package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AepUserDto;
import com.aistareco.aep.model.AepUser;
import com.aistareco.aep.service.AepUserService;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/users")
public class AdminUserController {

    private final AepUserService userService;

    public AdminUserController(AepUserService userService) {
        this.userService = userService;
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
    public ApiResponse<AepUserDto> create(@RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.create(body));
    }

    @PutMapping("/{id}")
    public ApiResponse<AepUserDto> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        return ApiResponse.of(userService.update(id, body));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        userService.delete(id);
    }
}
