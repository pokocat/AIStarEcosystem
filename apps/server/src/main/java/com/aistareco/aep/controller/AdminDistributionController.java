package com.aistareco.aep.controller;

import com.aistareco.aep.dto.DistributionContentDto;
import com.aistareco.aep.dto.PlatformDto;
import com.aistareco.aep.dto.PlatformViewPointDto;
import com.aistareco.aep.repository.DistributionContentRepository;
import com.aistareco.aep.repository.PlatformRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/distribution")
public class AdminDistributionController {

    private final PlatformRepository platformRepo;
    private final DistributionContentRepository contentRepo;

    public AdminDistributionController(PlatformRepository platformRepo,
                                        DistributionContentRepository contentRepo) {
        this.platformRepo = platformRepo;
        this.contentRepo = contentRepo;
    }

    @GetMapping("/platforms")
    public ApiResponse<List<PlatformDto>> platforms() {
        List<PlatformDto> list = platformRepo.findAll().stream()
                .map(PlatformDto::from).toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/content")
    public ApiResponse<List<DistributionContentDto>> content() {
        List<DistributionContentDto> list = contentRepo.findAll().stream()
                .map(DistributionContentDto::from).toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/platform-views")
    public ApiResponse<List<PlatformViewPointDto>> platformViews() {
        // Aggregation from platforms — group by name with total followers as proxy for views
        List<PlatformViewPointDto> list = platformRepo.findAll().stream()
                .map(p -> new PlatformViewPointDto(p.getName(), p.getFollowersCount()))
                .toList();
        return ApiResponse.of(list);
    }
}
