package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

/** 场景目录与拼话：AI 图片 / AI 视频两页只认这两个接口（docs/studio-scene-creation.md §7）。都不扣积分。 */
@RestController @RequestMapping("/api/v1/ip-studio/scenes")
public class StudioSceneController {
    private final StudioSceneCatalog scenes;
    public StudioSceneController(StudioSceneCatalog scenes) { this.scenes = scenes; }

    @GetMapping
    public ApiResponse<StudioSceneCatalog.Catalog> catalog() { return ApiResponse.of(scenes.catalog()); }

    /** 出图描述（场景描述 + 补充要求）或交给创作助手的话（带该场景的方法）；缺必填素材时 400，原因可直接给用户看。 */
    @PostMapping("/compose")
    public ApiResponse<StudioSceneCatalog.Composed> compose(@RequestBody StudioSceneCatalog.ComposeRequest request) {
        return ApiResponse.of(scenes.compose(request));
    }
}
