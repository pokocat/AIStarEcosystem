package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminCelebrityAuthorizationDto;
import com.aistareco.aep.dto.AdminCelebrityAuthorizationTransitionDto;
import com.aistareco.aep.dto.AdminCelebrityAuthorizationUpsertDto;
import com.aistareco.aep.service.AuditService;
import com.aistareco.aep.service.CelebrityAuthorizationAdminService;
import com.aistareco.common.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
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
    private final AuditService auditService;

    public AdminCelebrityAuthorizationController(CelebrityAuthorizationAdminService service,
                                                 AuditService auditService) {
        this.service = service;
        this.auditService = auditService;
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

    /** 状态机推进。reason 必填，会写入 AuditLog（who / before → after / reason）。 */
    @PostMapping("/{id}/transition")
    public ApiResponse<AdminCelebrityAuthorizationDto> transition(
            Principal principal,
            @PathVariable String id,
            @RequestBody AdminCelebrityAuthorizationTransitionDto req,
            HttpServletRequest request) {
        String operatorUserId = principal != null ? principal.getName() : "admin";
        String before = service.get(id).status();   // 推进前状态，仅用于审计 detail
        AdminCelebrityAuthorizationDto dto = service.transition(id, req, operatorUserId);
        auditService.recordAdminAction(
                AuditService.Actions.CELEBRITY_AUTH_TRANSITION,
                "celebrity_star_authorization", id,
                "授权状态推进 " + before + " → " + dto.status()
                        + (req != null && req.reason() != null ? "：" + req.reason() : ""),
                request);
        return ApiResponse.of(dto);
    }
}
