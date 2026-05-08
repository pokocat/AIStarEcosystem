package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminCelebrityAuthorizationDto;
import com.aistareco.aep.dto.AdminCelebrityAuthorizationTransitionDto;
import com.aistareco.aep.dto.AdminCelebrityAuthorizationUpsertDto;
import com.aistareco.aep.service.CelebrityAuthorizationAdminService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * Admin 侧授权关系管理：/api/admin/celebrity/star-authorizations/*。
 * v0.5 新增。
 */
@RestController
@RequestMapping("/api/admin/celebrity/star-authorizations")
public class AdminCelebrityAuthorizationController {

    private final CelebrityAuthorizationAdminService service;

    public AdminCelebrityAuthorizationController(CelebrityAuthorizationAdminService service) {
        this.service = service;
    }

    @GetMapping
    public ApiResponse<List<AdminCelebrityAuthorizationDto>> list(
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String starId,
            @RequestParam(required = false) String status) {
        return ApiResponse.of(service.list(userId, starId, status));
    }

    @GetMapping("/{id}")
    public ApiResponse<AdminCelebrityAuthorizationDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AdminCelebrityAuthorizationDto> create(@RequestBody AdminCelebrityAuthorizationUpsertDto req) {
        return ApiResponse.of(service.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<AdminCelebrityAuthorizationDto> update(@PathVariable String id,
                                                               @RequestBody AdminCelebrityAuthorizationUpsertDto req) {
        return ApiResponse.of(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    /** 状态机推进。reason 必填，会写入 AuditLog。 */
    @PostMapping("/{id}/transition")
    public ApiResponse<AdminCelebrityAuthorizationDto> transition(
            Principal principal,
            @PathVariable String id,
            @RequestBody AdminCelebrityAuthorizationTransitionDto req) {
        String operatorUserId = principal != null ? principal.getName() : "admin";
        return ApiResponse.of(service.transition(id, req, operatorUserId));
    }
}
