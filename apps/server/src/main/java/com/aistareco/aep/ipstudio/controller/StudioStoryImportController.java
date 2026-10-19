package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioStoryImportService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.security.Principal;

@RestController
@RequestMapping("/api/v1/ip-studio/projects")
public class StudioStoryImportController {
    private final IpProjectService projects;
    private final StudioStoryImportService stories;
    public StudioStoryImportController(IpProjectService projects, StudioStoryImportService stories) {
        this.projects = projects; this.stories = stories;
    }
    @PostMapping(value = "/{id}/story-import", consumes = "multipart/form-data")
    public ApiResponse<StudioStoryImportService.StoryImportResult> extract(
            Principal principal, @PathVariable String id, @RequestPart("file") MultipartFile file) {
        if (principal == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        projects.required(principal.getName(), id);
        return ApiResponse.of(stories.extract(file));
    }
}
