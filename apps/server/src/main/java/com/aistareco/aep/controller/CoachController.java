package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.CopyrightItem;
import com.aistareco.aep.repository.CopyrightItemRepository;
import com.aistareco.aep.repository.DistributionQueueItemRepository;
import com.aistareco.aep.repository.SignedArtistRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户侧经纪人（Coach）后台只读视图：/api/coach/*。
 * 管理写入仍走 {@link AdminCoachController}。
 */
@RestController
@RequestMapping("/api/coach")
public class CoachController {

    private final SignedArtistRepository signedArtistRepo;
    private final DistributionQueueItemRepository distributionQueueRepo;
    private final CopyrightItemRepository copyrightRepo;

    public CoachController(SignedArtistRepository signedArtistRepo,
                           DistributionQueueItemRepository distributionQueueRepo,
                           CopyrightItemRepository copyrightRepo) {
        this.signedArtistRepo = signedArtistRepo;
        this.distributionQueueRepo = distributionQueueRepo;
        this.copyrightRepo = copyrightRepo;
    }

    @GetMapping("/artists")
    public ApiResponse<List<SignedArtistDto>> listArtists() {
        return ApiResponse.of(signedArtistRepo.findAll(Sort.by("id").ascending())
                .stream().map(SignedArtistDto::from).toList());
    }

    @GetMapping("/revenue")
    public ApiResponse<List<CoachRevenuePointDto>> revenue() {
        // 收益曲线聚合尚未落库，先返回空列表以便前端进入真实请求通路。
        return ApiResponse.of(List.of());
    }

    @GetMapping("/distribution-queue")
    public ApiResponse<List<DistributionQueueItemDto>> distributionQueue() {
        return ApiResponse.of(distributionQueueRepo.findAll(Sort.by("id").ascending())
                .stream().map(DistributionQueueItemDto::from).toList());
    }

    @GetMapping("/copyright/pending")
    public ApiResponse<List<CopyrightItemDto>> pendingCopyrights() {
        return ApiResponse.of(copyrightRepo
                .findByStatus(CopyrightItem.CopyrightStatus.PENDING)
                .stream().map(CopyrightItemDto::from).toList());
    }

    @GetMapping("/category-distribution")
    public ApiResponse<List<CoachCategoryDistributionDto>> categoryDistribution() {
        return ApiResponse.of(List.of());
    }
}
