package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ExpressionDto;
import com.aistareco.aep.dto.GestureDto;
import com.aistareco.aep.dto.PoseDto;
import com.aistareco.aep.model.UserInventory;
import com.aistareco.aep.service.StoreService;
import com.aistareco.common.ApiResponse;
import com.aistareco.repository.ExpressionRepository;
import com.aistareco.repository.GestureRepository;
import com.aistareco.repository.PoseRepository;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;

/**
 * 用户侧姿态 / 表情 / 手势库：/api/poses、/api/expressions、/api/gestures。
 */
@RestController
public class PoseController {

    private final PoseRepository poseRepo;
    private final ExpressionRepository expressionRepo;
    private final GestureRepository gestureRepo;
    private final StoreService storeService;

    public PoseController(PoseRepository poseRepo,
                          ExpressionRepository expressionRepo,
                          GestureRepository gestureRepo,
                          StoreService storeService) {
        this.poseRepo = poseRepo;
        this.expressionRepo = expressionRepo;
        this.gestureRepo = gestureRepo;
        this.storeService = storeService;
    }

    @GetMapping("/api/poses")
    public ApiResponse<List<PoseDto>> poses(Principal principal) {
        String userId = principal != null ? principal.getName() : null;
        return ApiResponse.of(poseRepo.findAll(Sort.by("id").ascending())
                .stream()
                .map(p -> PoseDto.from(p,
                        userId != null && storeService.isOwned(userId, UserInventory.ItemType.POSE, p.getId())))
                .toList());
    }

    @GetMapping("/api/expressions")
    public ApiResponse<List<ExpressionDto>> expressions(Principal principal) {
        String userId = principal != null ? principal.getName() : null;
        return ApiResponse.of(expressionRepo.findAll(Sort.by("id").ascending())
                .stream()
                .map(e -> ExpressionDto.from(e,
                        userId != null && storeService.isOwned(userId, UserInventory.ItemType.EXPRESSION, e.getId())))
                .toList());
    }

    @GetMapping("/api/gestures")
    public ApiResponse<List<GestureDto>> gestures(Principal principal) {
        String userId = principal != null ? principal.getName() : null;
        return ApiResponse.of(gestureRepo.findAll(Sort.by("id").ascending())
                .stream()
                .map(g -> GestureDto.from(g,
                        userId != null && storeService.isOwned(userId, UserInventory.ItemType.GESTURE, g.getId())))
                .toList());
    }
}
