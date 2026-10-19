package com.aistareco.aep.ipstudio.controller;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.StudioMediaImportService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.security.Principal;
@RestController
@RequestMapping("/api/v1/ip-studio/projects")
public class StudioMediaImportController {
    private final IpProjectService projects; private final StudioMediaImportService imports;
    public StudioMediaImportController(IpProjectService projects, StudioMediaImportService imports) { this.projects = projects; this.imports = imports; }
    @PostMapping(value="/{id}/media-import", consumes="multipart/form-data")
    public ApiResponse<StudioMediaImportService.MediaImportResult> upload(Principal principal, @PathVariable String id,
            @RequestPart("file") MultipartFile file, @RequestParam String mediaType) {
        if (principal == null) throw new BusinessException(HttpStatus.UNAUTHORIZED,"UNAUTHORIZED","请先登录");
        projects.required(principal.getName(), id);
        return ApiResponse.of(imports.upload(principal.getName(), file, mediaType));
    }
}
