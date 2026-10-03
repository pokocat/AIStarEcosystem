package com.aistareco.aep.controller;

import com.aistareco.aep.dto.DramaCanvasRunDto;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasAssembleRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasExtractRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageBatchBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasImageRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasScriptRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasStoryboardRunBody;
import com.aistareco.aep.dto.DramaCanvasRunDto.CanvasVideoRunBody;
import com.aistareco.aep.service.DramaCanvasRunService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 画布的生成与运行记录（v0.198，设计真源 docs/drama-canvas-plan.md §4）。与 {@code DramaCanvasController}
 * 同一前缀、路径不重叠。
 *
 * <p>所有生成接口 body 都带 {@code clientRequestId}（幂等：同一个键回原记录、不重复扣费）+ {@code docVersion}
 * （库里版本对不上 409 {@code DRAMA_CANVAS_STALE}）。提示词 / 参考图 / 首帧 / 片段顺序一律由服务端从已保存的文档里取。
 * 生成是异步的：返回 queued 的运行记录，前端按 {@code GET runs?ids=} 轮询。
 *
 * <p>{@code /api/me/**} authenticated；{@code /api/me/drama/**} 归短剧开通。归属按 principal 在 service 里隔离。
 */
@RestController
@RequestMapping("/api/me/drama/canvases/{id}/runs")
public class DramaCanvasRunController {

    private final DramaCanvasRunService service;

    public DramaCanvasRunController(DramaCanvasRunService service) {
        this.service = service;
    }

    /** 写故事大纲 / 分集剧情 / 某一集剧本（CanvasScriptRunBody）。 */
    @PostMapping("/script")
    public ApiResponse<DramaCanvasRunDto> script(Principal principal, @PathVariable String id,
                                                 @RequestBody(required = false) CanvasScriptRunBody body) {
        return ApiResponse.of(service.submitScript(uid(principal), id, body));
    }

    /** 拆出角色和场景（CanvasExtractRunBody）。 */
    @PostMapping("/extract")
    public ApiResponse<DramaCanvasRunDto> extract(Principal principal, @PathVariable String id,
                                                  @RequestBody(required = false) CanvasExtractRunBody body) {
        return ApiResponse.of(service.submitExtract(uid(principal), id, body));
    }

    /** 造型 / 场景 / 素材 / 片段首帧出图（CanvasImageRunBody）。 */
    @PostMapping("/image")
    public ApiResponse<DramaCanvasRunDto> image(Principal principal, @PathVariable String id,
                                                @RequestBody(required = false) CanvasImageRunBody body) {
        return ApiResponse.of(service.submitImage(uid(principal), id, body));
    }

    /** 批量出图（CanvasImageBatchBody → DramaCanvasRun[]）。 */
    @PostMapping("/image-batch")
    public ApiResponse<List<DramaCanvasRunDto>> imageBatch(Principal principal, @PathVariable String id,
                                                           @RequestBody(required = false) CanvasImageBatchBody body) {
        return ApiResponse.of(service.submitImageBatch(uid(principal), id, body));
    }

    /** 本集分镜脚本（CanvasStoryboardRunBody）。 */
    @PostMapping("/storyboard")
    public ApiResponse<DramaCanvasRunDto> storyboard(Principal principal, @PathVariable String id,
                                                     @RequestBody(required = false) CanvasStoryboardRunBody body) {
        return ApiResponse.of(service.submitStoryboard(uid(principal), id, body));
    }

    /** 片段视频（CanvasVideoRunBody）。 */
    @PostMapping("/video")
    public ApiResponse<DramaCanvasRunDto> video(Principal principal, @PathVariable String id,
                                                @RequestBody(required = false) CanvasVideoRunBody body) {
        return ApiResponse.of(service.submitVideo(uid(principal), id, body));
    }

    /** 合成成片（CanvasAssembleRunBody），免费。 */
    @PostMapping("/assemble")
    public ApiResponse<DramaCanvasRunDto> assemble(Principal principal, @PathVariable String id,
                                                   @RequestBody(required = false) CanvasAssembleRunBody body) {
        return ApiResponse.of(service.submitAssemble(uid(principal), id, body));
    }

    /** 批量查运行记录（刷新接回用）：{@code ?ids=a,b,c}，最多 50 个；只返回本人、本画布的。 */
    @GetMapping
    public ApiResponse<List<DramaCanvasRunDto>> list(Principal principal, @PathVariable String id,
                                                     @RequestParam(name = "ids", required = false) String ids) {
        return ApiResponse.of(service.list(uid(principal), id, ids));
    }

    /**
     * 按幂等键只查不建：{@code ?clientRequestId=<key>} → DramaCanvasRun[]（单条 0/1 条，批量按原始键查到整批，
     * 没受理过 → []）。没有副作用、不校验 docVersion、不扣费；键不合规 400 DRAMA_CANVAS_REQUEST_ID_INVALID。
     */
    @GetMapping("/lookup")
    public ApiResponse<List<DramaCanvasRunDto>> lookup(Principal principal, @PathVariable String id,
                                                       @RequestParam(name = "clientRequestId", required = false)
                                                       String clientRequestId) {
        return ApiResponse.of(service.lookup(uid(principal), id, clientRequestId));
    }

    /** 取消排队中的（已经交给厂商的 409 DRAMA_CANVAS_RUN_NOT_CANCELABLE）。 */
    @PostMapping("/{runId}/cancel")
    public ApiResponse<DramaCanvasRunDto> cancel(Principal principal, @PathVariable String id,
                                                 @PathVariable String runId) {
        return ApiResponse.of(service.cancel(uid(principal), id, runId));
    }

    private static String uid(Principal p) {
        if (p == null || p.getName() == null || p.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        }
        return p.getName();
    }
}
