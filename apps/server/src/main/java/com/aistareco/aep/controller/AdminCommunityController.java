package com.aistareco.aep.controller;

import com.aistareco.aep.dto.CommunityEventDto;
import com.aistareco.aep.dto.FanActivityDto;
import com.aistareco.aep.dto.FanGrowthPointDto;
import com.aistareco.aep.dto.FanTierDto;
import com.aistareco.aep.repository.CommunityEventRepository;
import com.aistareco.aep.repository.FanActivityRepository;
import com.aistareco.aep.repository.FanGrowthPointRepository;
import com.aistareco.aep.repository.FanTierRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/community")
public class AdminCommunityController {

    private final FanTierRepository fanTierRepo;
    private final FanGrowthPointRepository fanGrowthRepo;
    private final FanActivityRepository fanActivityRepo;
    private final CommunityEventRepository communityEventRepo;

    public AdminCommunityController(FanTierRepository fanTierRepo,
                                     FanGrowthPointRepository fanGrowthRepo,
                                     FanActivityRepository fanActivityRepo,
                                     CommunityEventRepository communityEventRepo) {
        this.fanTierRepo = fanTierRepo;
        this.fanGrowthRepo = fanGrowthRepo;
        this.fanActivityRepo = fanActivityRepo;
        this.communityEventRepo = communityEventRepo;
    }

    @GetMapping("/fan-tiers")
    public ApiResponse<List<FanTierDto>> fanTiers() {
        List<FanTierDto> list = fanTierRepo.findAll().stream()
                .map(FanTierDto::from).toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/fan-growth")
    public ApiResponse<List<FanGrowthPointDto>> fanGrowth() {
        List<FanGrowthPointDto> list = fanGrowthRepo.findAll().stream()
                .map(FanGrowthPointDto::from).toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/activities")
    public ApiResponse<List<FanActivityDto>> activities() {
        List<FanActivityDto> list = fanActivityRepo.findAll().stream()
                .map(FanActivityDto::from).toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/events")
    public ApiResponse<List<CommunityEventDto>> events() {
        List<CommunityEventDto> list = communityEventRepo.findAll().stream()
                .map(CommunityEventDto::from).toList();
        return ApiResponse.of(list);
    }
}
