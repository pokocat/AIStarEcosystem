package com.aistareco.aep.videostudio.controller;

import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJob;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioJobRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioModel;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimization;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioOptimizationRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplate;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioTemplateCreateRequest;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioUpload;
import com.aistareco.aep.videostudio.service.VideoStudioOptimizationService;
import com.aistareco.aep.videostudio.service.VideoStudioService;
import com.aistareco.aep.videostudio.service.VideoStudioTemplateService;
import com.aistareco.aep.videostudio.service.VideoStudioUploadService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.security.Principal;
import java.util.List;

/**
 * 视频生成区（web-celebrity「AI 创作 → 视频生成」，v0.199，设计真源 docs/video-studio-plan.md）。
 *
 * <p>挂在 {@code /api/me/celebrity/**}：{@code AepSecurityConfig} 的 {@code /api/me/**} 要求登录，
 * 开通闸由 {@code ProductRouteTable} 的 {@code any("/api/me/celebrity/**", CELEBRITY)} 判（不新增产品码）。
 * 未绑手机号的账号发 POST / DELETE 会被 {@code PhoneVerificationGuard} 先挡掉（403），这里不另写。
 *
 * <p>提交请求**没有价格字段**：价格只由服务端按计价参数算（MaterialOpsController 剥离客户端
 * credit_cost 的同一条纪律，这里是从请求形状上就不给这个口子）。
 */
@RestController
@RequestMapping("/api/me/celebrity/video-studio")
public class VideoStudioController {

    private final VideoStudioService studio;
    private final VideoStudioUploadService uploads;
    private final VideoStudioOptimizationService optimizations;
    private final VideoStudioTemplateService templates;

    public VideoStudioController(VideoStudioService studio,
                                 VideoStudioUploadService uploads,
                                 VideoStudioOptimizationService optimizations,
                                 VideoStudioTemplateService templates) {
        this.studio = studio;
        this.uploads = uploads;
        this.optimizations = optimizations;
        this.templates = templates;
    }

    /** 能在本区用的视频模型：合同（模式 / 规格 / 素材限制）+ 计价参数。一个都没有时是空数组。 */
    @GetMapping("/models")
    public ApiResponse<List<VideoStudioModel>> models(Principal principal) {
        uid(principal);
        return ApiResponse.of(studio.listModels());
    }

    /**
     * 上传一个素材（multipart：{@code file} + {@code mediaType} = image / video / audio）。
     * 两个字段都不强制绑定：缺了由服务端给明确的业务错误码，而不是框架的通用 400。
     */
    @PostMapping(value = "/uploads", consumes = "multipart/form-data")
    public ApiResponse<VideoStudioUpload> upload(Principal principal,
                                                 @RequestParam(value = "file", required = false) MultipartFile file,
                                                 @RequestParam(value = "mediaType", required = false) String mediaType) {
        return ApiResponse.of(uploads.upload(uid(principal), file, mediaType));
    }

    @PostMapping("/jobs")
    public ApiResponse<VideoStudioJob> submit(Principal principal, @RequestBody VideoStudioJobRequest request) {
        return ApiResponse.of(studio.submit(uid(principal), request));
    }

    /** 本人在本区的生成记录，新 → 旧，最多 100 条。 */
    @GetMapping("/jobs")
    public ApiResponse<List<VideoStudioJob>> jobs(Principal principal) {
        return ApiResponse.of(studio.listJobs(uid(principal)));
    }

    /** 不是本人的、不是本区的 → 404 VIDEO_STUDIO_JOB_NOT_FOUND。 */
    @GetMapping("/jobs/{id}")
    public ApiResponse<VideoStudioJob> job(Principal principal, @PathVariable String id) {
        return ApiResponse.of(studio.getJob(uid(principal), id));
    }

    // ── 智能优化 ──────────────────────────────────────────────────────────────

    /** 发起一次智能优化（后台执行，前端轮询 GET）。同一个 clientRequestId 重复提交 → 返回同一条，不重复冻结。 */
    @PostMapping("/prompt-optimizations")
    public ApiResponse<VideoStudioOptimization> optimize(Principal principal,
                                                         @RequestBody VideoStudioOptimizationRequest request) {
        return ApiResponse.of(optimizations.create(uid(principal), request));
    }

    /** 不是本人的 → 404 VIDEO_STUDIO_OPTIMIZATION_NOT_FOUND。 */
    @GetMapping("/prompt-optimizations/{id}")
    public ApiResponse<VideoStudioOptimization> optimization(Principal principal, @PathVariable String id) {
        return ApiResponse.of(optimizations.get(uid(principal), id));
    }

    // ── 模板 / 做同款 ─────────────────────────────────────────────────────────

    /** 在架的官方模板 + 我自己的，新 → 旧，最多 100 条。 */
    @GetMapping("/templates")
    public ApiResponse<List<VideoStudioTemplate>> templates(Principal principal) {
        return ApiResponse.of(templates.list(uid(principal)));
    }

    /** 官方且在架，或本人的；否则 404 VIDEO_STUDIO_TEMPLATE_NOT_FOUND。 */
    @GetMapping("/templates/{id}")
    public ApiResponse<VideoStudioTemplate> template(Principal principal, @PathVariable String id) {
        return ApiResponse.of(templates.get(uid(principal), id));
    }

    /** 把一条成功的生成记录存成模板；official=true 只有运营能用（查库判定）。 */
    @PostMapping("/templates")
    public ApiResponse<VideoStudioTemplate> saveTemplate(Principal principal,
                                                         @RequestBody VideoStudioTemplateCreateRequest request) {
        return ApiResponse.of(templates.create(uid(principal), request));
    }

    /** 本人删自己的；官方模板本人或任一运营可撤回（软删）。成功 204。 */
    @DeleteMapping("/templates/{id}")
    public ResponseEntity<Void> withdrawTemplate(Principal principal, @PathVariable String id) {
        templates.withdraw(uid(principal), id);
        return ResponseEntity.noContent().build();
    }

    private static String uid(Principal p) {
        if (p == null || p.getName() == null || p.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        }
        return p.getName();
    }
}
