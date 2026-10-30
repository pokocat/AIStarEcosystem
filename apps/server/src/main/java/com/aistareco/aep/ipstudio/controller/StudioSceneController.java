package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.scene.StudioSceneCatalog;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.*;

/** 场景目录与拼话：AI 图片 / AI 视频两页只认这两个接口（docs/studio-scene-creation.md §7）。都不扣积分。 */
@RestController @RequestMapping("/api/v1/ip-studio/scenes")
public class StudioSceneController {
    private final StudioSceneCatalog scenes;
    private final FileStorageService storage;
    public StudioSceneController(StudioSceneCatalog scenes, FileStorageService storage) { this.scenes = scenes; this.storage = storage; }

    /** 上架的场景；封面和参考示例是签过名的地址。运营在后台改过就是改过的那份。 */
    @GetMapping
    public ApiResponse<StudioSceneCatalog.Catalog> catalog() { return ApiResponse.of(scenes.published(storage::signedUrl)); }

    /** 首页「你想做什么？」的卡片：公开只读（没登录的访客在首页也看得到），只有标题、说明、落点场景和封面。 */
    @GetMapping("/home")
    public ApiResponse<java.util.List<StudioSceneCatalog.HomeCard>> home() { return ApiResponse.of(scenes.homeCards(storage::signedUrl)); }

    /** 出图描述、编导写脚本的要求或交给创作助手的话（带该场景的方法）；缺必填素材时 400，原因可直接给用户看。 */
    @PostMapping("/compose")
    public ApiResponse<StudioSceneCatalog.Composed> compose(@RequestBody StudioSceneCatalog.ComposeRequest request) {
        return ApiResponse.of(scenes.compose(request));
    }
}
