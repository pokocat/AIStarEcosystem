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
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户侧社区 / 粉丝运营只读视图：/api/community/*。
 * 管理写入仍走 {@link AdminCommunityController}。
 */
@RestController
@RequestMapping("/api/community")
public class CommunityController {

    private final FanTierRepository fanTierRepo;
    private final FanGrowthPointRepository fanGrowthRepo;
    private final FanActivityRepository fanActivityRepo;
    private final CommunityEventRepository communityEventRepo;

    public CommunityController(FanTierRepository fanTierRepo,
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
        return ApiResponse.of(fanTierRepo.findAll(Sort.by("id").ascending())
                .stream().map(FanTierDto::from).toList());
    }

    @GetMapping("/fan-growth")
    public ApiResponse<List<FanGrowthPointDto>> fanGrowth() {
        return ApiResponse.of(fanGrowthRepo.findAll(Sort.by("id").ascending())
                .stream().map(FanGrowthPointDto::from).toList());
    }

    @GetMapping("/activities")
    public ApiResponse<List<FanActivityDto>> activities() {
        return ApiResponse.of(fanActivityRepo.findAll(Sort.by("id").ascending())
                .stream().map(FanActivityDto::from).toList());
    }

    @GetMapping("/events")
    public ApiResponse<List<CommunityEventDto>> events() {
        return ApiResponse.of(communityEventRepo.findAll(Sort.by("id").ascending())
                .stream().map(CommunityEventDto::from).toList());
    }
}
