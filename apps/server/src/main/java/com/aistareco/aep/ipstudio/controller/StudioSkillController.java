package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.DraftRequest;
import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.SkillSummary;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.aep.ipstudio.skill.StudioSkillDraftService;
import com.aistareco.aep.security.InAppOperatorGuard;
import com.aistareco.common.ApiResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.List;

/**
 * GET /api/v1/ip-studio/studio/skills — active skills offered for new work (S3: DB-backed, current version of each).
 * POST /api/v1/ip-studio/projects/{id}/skill-drafts — operators only: distill a finished execution into a draft version
 * (403 STUDIO_SKILL_DRAFT_FORBIDDEN for everyone else; the operator judgment is {@link InAppOperatorGuard}).
 */
@RestController
@RequestMapping("/api/v1/ip-studio")
public class StudioSkillController {
    private final StudioSkillCatalog catalog;
    private final StudioSkillDraftService drafts;
    private final InAppOperatorGuard guard;
    public StudioSkillController(StudioSkillCatalog catalog, StudioSkillDraftService drafts, InAppOperatorGuard guard) {
        this.catalog = catalog; this.drafts = drafts; this.guard = guard;
    }

    @GetMapping("/studio/skills")
    public ApiResponse<List<SkillSummary>> skills() { return ApiResponse.of(catalog.list()); }

    @PostMapping("/projects/{id}/skill-drafts")
    public ApiResponse<IpRunDto> distill(Principal principal, Authentication auth, @PathVariable String id, @RequestBody DraftRequest request) {
        return ApiResponse.of(drafts.submit(principal.getName(), id, request, guard.isOperator(auth)));
    }
}
