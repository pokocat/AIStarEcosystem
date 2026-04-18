package com.aistareco.aep.controller;

import com.aistareco.aep.dto.*;
import com.aistareco.aep.model.CopyrightItem;
import com.aistareco.aep.repository.CopyrightItemRepository;
import com.aistareco.aep.repository.DistributionQueueItemRepository;
import com.aistareco.aep.repository.SignedArtistRepository;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/coach")
public class AdminCoachController {

    private final SignedArtistRepository signedArtistRepo;
    private final DistributionQueueItemRepository distributionQueueRepo;
    private final CopyrightItemRepository copyrightRepo;

    public AdminCoachController(SignedArtistRepository signedArtistRepo,
                                DistributionQueueItemRepository distributionQueueRepo,
                                CopyrightItemRepository copyrightRepo) {
        this.signedArtistRepo = signedArtistRepo;
        this.distributionQueueRepo = distributionQueueRepo;
        this.copyrightRepo = copyrightRepo;
    }

    @GetMapping("/artists")
    public ApiResponse<List<SignedArtistDto>> listArtists() {
        List<SignedArtistDto> list = signedArtistRepo.findAll().stream()
                .map(SignedArtistDto::from)
                .toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/revenue")
    public ApiResponse<List<CoachRevenuePointDto>> revenue() {
        return ApiResponse.of(List.of());
    }

    @GetMapping("/distribution-queue")
    public ApiResponse<List<DistributionQueueItemDto>> distributionQueue() {
        List<DistributionQueueItemDto> list = distributionQueueRepo.findAll().stream()
                .map(DistributionQueueItemDto::from)
                .toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/copyright/pending")
    public ApiResponse<List<CopyrightItemDto>> pendingCopyrights() {
        List<CopyrightItemDto> list = copyrightRepo.findByStatus(CopyrightItem.CopyrightStatus.PENDING).stream()
                .map(CopyrightItemDto::from)
                .toList();
        return ApiResponse.of(list);
    }

    @GetMapping("/category-distribution")
    public ApiResponse<List<CoachCategoryDistributionDto>> categoryDistribution() {
        return ApiResponse.of(List.of());
    }
}
