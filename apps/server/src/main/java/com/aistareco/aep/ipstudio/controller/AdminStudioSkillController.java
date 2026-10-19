package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.*;
import com.aistareco.aep.ipstudio.skill.StudioSkillAdminService;
import com.aistareco.common.ApiResponse;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * Studio skill registry in admin (S3, /api/admin/studio/skills; SUPER_ADMIN / OPERATOR — FINANCE_ADMIN is not let in).
 * Versions are immutable: publishing, rolling back and publishing a distilled draft each make a version current; nothing
 * is edited in place. The dry-run calls the planning model once without billing anyone and saves nothing.
 */
@RestController
@PreAuthorize("hasAnyRole('SUPER_ADMIN', 'OPERATOR')")
@RequestMapping("/api/admin/studio/skills")
public class AdminStudioSkillController {
    private final StudioSkillAdminService service;
    public AdminStudioSkillController(StudioSkillAdminService service) { this.service = service; }

    @GetMapping
    public ApiResponse<List<SkillAdminItem>> list() { return ApiResponse.of(service.list()); }

    @PostMapping
    public ApiResponse<SkillAdminDetail> create(@RequestBody CreateRequest body, Principal principal) {
        return ApiResponse.of(service.create(body, by(principal)));
    }

    @GetMapping("/{key}")
    public ApiResponse<SkillAdminDetail> detail(@PathVariable String key) { return ApiResponse.of(service.detail(key)); }

    @GetMapping("/{key}/versions")
    public ApiResponse<List<SkillVersion>> versions(@PathVariable String key) { return ApiResponse.of(service.versions(key)); }

    @GetMapping("/{key}/versions/{version}")
    public ApiResponse<SkillVersion> version(@PathVariable String key, @PathVariable int version) {
        return ApiResponse.of(service.version(key, version));
    }

    @PostMapping("/{key}/versions")
    public ApiResponse<SkillAdminDetail> publish(@PathVariable String key, @RequestBody PublishRequest body, Principal principal) {
        return ApiResponse.of(service.publish(key, body, by(principal)));
    }

    @PostMapping("/{key}/versions/{version}/publish")
    public ApiResponse<SkillAdminDetail> publishDraft(@PathVariable String key, @PathVariable int version,
                                                      @RequestBody(required = false) VersionActionRequest body, Principal principal) {
        return ApiResponse.of(service.publishDraft(key, version, body, by(principal)));
    }

    @PutMapping("/{key}/status")
    public ApiResponse<SkillAdminDetail> status(@PathVariable String key, @RequestBody StatusRequest body, Principal principal) {
        return ApiResponse.of(service.setStatus(key, body, by(principal)));
    }

    @PostMapping("/{key}/rollback/{version}")
    public ApiResponse<SkillAdminDetail> rollback(@PathVariable String key, @PathVariable int version,
                                                  @RequestBody(required = false) VersionActionRequest body, Principal principal) {
        return ApiResponse.of(service.rollback(key, version, body, by(principal)));
    }

    @PostMapping("/{key}/dry-run")
    public ApiResponse<DryRunResult> dryRun(@PathVariable String key, @RequestBody DryRunRequest body) {
        return ApiResponse.of(service.dryRun(key, body));
    }

    private static String by(Principal principal) { return principal == null ? "admin" : principal.getName(); }
}
