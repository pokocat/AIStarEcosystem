package com.aistareco.aep.controller;

import com.aistareco.aep.dto.DramaCanvasDetailDto;
import com.aistareco.aep.dto.DramaCanvasSummaryDto;
import com.aistareco.aep.dto.SaveDramaCanvasResultDto;
import com.aistareco.aep.dto.SignCanvasAssetsResultDto;
import com.aistareco.aep.dto.SplitCanvasScriptResultDto;
import com.aistareco.aep.service.DramaCanvasService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短剧画布（v0.198，设计真源 docs/drama-canvas-plan.md §4）：列表 / 新建 / 详情 / 保存 / 删除 / 粘贴剧本切集 / 签名地址换新。
 * 生成与运行记录（{@code /runs/**}）在另一个 controller，同一前缀、路径不重叠。
 *
 * <p>{@code /api/me/**} 在 AepSecurityConfig 下 authenticated；{@code /api/me/drama/**} 由 ProductRouteTable 归短剧开通。
 * 归属一律按 principal 在 service 里隔离（不存在与不是本人的都是 404）。
 */
@RestController
@RequestMapping("/api/me/drama/canvases")
public class DramaCanvasController {

    private final DramaCanvasService service;

    public DramaCanvasController(DramaCanvasService service) {
        this.service = service;
    }

    /** 我的画布 DramaCanvasSummary[]（按 updatedAt 倒序）。 */
    @GetMapping
    public ApiResponse<List<DramaCanvasSummaryDto>> list(Principal principal) {
        return ApiResponse.of(service.list(uid(principal)));
    }

    /** 新建 CreateDramaCanvasBody → DramaCanvasDetail（免费）。 */
    @PostMapping
    public ApiResponse<DramaCanvasDetailDto> create(Principal principal,
                                                    @RequestBody(required = false) DramaCanvasService.CreateBody body) {
        return ApiResponse.of(service.create(uid(principal), body));
    }

    /** 详情 DramaCanvasDetail（doc 已给本人的 key 派生 url）。 */
    @GetMapping("/{id}")
    public ApiResponse<DramaCanvasDetailDto> get(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.detail(uid(principal), id));
    }

    /** 保存 SaveDramaCanvasBody{doc, title?, baseDocVersion} → SaveDramaCanvasResult；版本对不上 409。 */
    @PutMapping("/{id}")
    public ApiResponse<SaveDramaCanvasResultDto> save(Principal principal, @PathVariable String id,
                                                      @RequestBody(required = false) DramaCanvasService.SaveBody body) {
        return ApiResponse.of(service.save(uid(principal), id, body));
    }

    /** 软删。 */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(Principal principal, @PathVariable String id) {
        service.delete(uid(principal), id);
    }

    /** 粘贴剧本按「第 X 集」切开 SplitCanvasScriptBody → SplitCanvasScriptResult（免费、同步、不落库）。 */
    @PostMapping("/{id}/script/split")
    public ApiResponse<SplitCanvasScriptResultDto> split(Principal principal, @PathVariable String id,
                                                         @RequestBody(required = false) DramaCanvasService.SplitBody body) {
        return ApiResponse.of(service.split(uid(principal), id, body));
    }

    /** 签名地址换新 SignCanvasAssetsBody{keys} → SignCanvasAssetsResult{urls}：只签本人的 key，别的不出现。 */
    @PostMapping("/{id}/assets/sign")
    public ApiResponse<SignCanvasAssetsResultDto> signAssets(Principal principal, @PathVariable String id,
                                                             @RequestBody(required = false) DramaCanvasService.SignBody body) {
        return ApiResponse.of(service.signAssets(uid(principal), id, body));
    }

    private static String uid(Principal p) {
        if (p == null || p.getName() == null || p.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        }
        return p.getName();
    }
}
