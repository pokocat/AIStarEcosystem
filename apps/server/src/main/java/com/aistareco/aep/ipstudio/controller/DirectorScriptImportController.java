package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.service.StudioStoryImportService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;

/** Extract before a work exists; the user previews and saves via the normal versioned work APIs. */
@RestController
@RequestMapping("/api/v1/ip-studio/director")
public class DirectorScriptImportController {
    private final StudioStoryImportService documents;

    public DirectorScriptImportController(StudioStoryImportService documents) { this.documents = documents; }

    @PostMapping(value = "/script-import", consumes = "multipart/form-data")
    public ApiResponse<StudioStoryImportService.StoryImportResult> extract(
            Principal principal, @RequestPart("file") MultipartFile file) {
        if (principal == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return ApiResponse.of(documents.extractScript(file));
    }
}
