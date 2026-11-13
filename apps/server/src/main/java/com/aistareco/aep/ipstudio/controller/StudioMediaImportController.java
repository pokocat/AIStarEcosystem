package com.aistareco.aep.ipstudio.controller;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioMediaImportService;
import com.aistareco.aep.ipstudio.service.StudioMediaJobs;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.security.Principal;
@RestController
@RequestMapping("/api/v1/ip-studio/projects")
public class StudioMediaImportController {
    private final IpProjectService projects;
    private final StudioMediaImportService imports;
    private final StudioMediaJobs jobs;
    public StudioMediaImportController(IpProjectService projects, StudioMediaImportService imports, StudioMediaJobs jobs) {
        this.projects = projects;
        this.imports = imports;
        this.jobs = jobs;
    }
    @PostMapping(value="/{id}/media-import", consumes="multipart/form-data")
    public ApiResponse<StudioMediaImportService.UploadResponse> upload(Principal principal, @PathVariable String id,
            @RequestPart("file") MultipartFile file, @RequestParam String mediaType,
            @RequestParam(defaultValue="false") boolean background) {
        if (principal == null) throw new BusinessException(HttpStatus.UNAUTHORIZED,"UNAUTHORIZED","请先登录");
        projects.required(principal.getName(), id);
        return ApiResponse.of(imports.accept(principal.getName(), file, mediaType, null, background, jobs));
    }
}
