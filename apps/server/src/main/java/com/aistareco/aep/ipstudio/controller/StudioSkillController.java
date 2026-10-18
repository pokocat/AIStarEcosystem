package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.StudioSkillDtos.SkillSummary;
import com.aistareco.aep.ipstudio.skill.StudioSkillCatalog;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

/** GET /api/v1/ip-studio/studio/skills — repository skill files currently offered for new work (S1/S2: no skill table). */
@RestController
@RequestMapping("/api/v1/ip-studio")
public class StudioSkillController {
    private final StudioSkillCatalog catalog;
    public StudioSkillController(StudioSkillCatalog catalog) { this.catalog = catalog; }

    @GetMapping("/studio/skills")
    public ApiResponse<List<SkillSummary>> skills() { return ApiResponse.of(catalog.list()); }
}
