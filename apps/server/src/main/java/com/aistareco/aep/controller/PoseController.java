package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ExpressionDto;
import com.aistareco.aep.dto.GestureDto;
import com.aistareco.aep.dto.PoseDto;
import com.aistareco.common.ApiResponse;
import com.aistareco.repository.ExpressionRepository;
import com.aistareco.repository.GestureRepository;
import com.aistareco.repository.PoseRepository;
import org.springframework.data.domain.Sort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * 用户侧姿态 / 表情 / 手势库：/api/poses、/api/expressions、/api/gestures。
 */
@RestController
public class PoseController {

    private final PoseRepository poseRepo;
    private final ExpressionRepository expressionRepo;
    private final GestureRepository gestureRepo;

    public PoseController(PoseRepository poseRepo,
                          ExpressionRepository expressionRepo,
                          GestureRepository gestureRepo) {
        this.poseRepo = poseRepo;
        this.expressionRepo = expressionRepo;
        this.gestureRepo = gestureRepo;
    }

    @GetMapping("/api/poses")
    public ApiResponse<List<PoseDto>> poses() {
        return ApiResponse.of(poseRepo.findAll(Sort.by("id").ascending())
                .stream().map(PoseDto::from).toList());
    }

    @GetMapping("/api/expressions")
    public ApiResponse<List<ExpressionDto>> expressions() {
        return ApiResponse.of(expressionRepo.findAll(Sort.by("id").ascending())
                .stream().map(ExpressionDto::from).toList());
    }

    @GetMapping("/api/gestures")
    public ApiResponse<List<GestureDto>> gestures() {
        return ApiResponse.of(gestureRepo.findAll(Sort.by("id").ascending())
                .stream().map(GestureDto::from).toList());
    }
}
