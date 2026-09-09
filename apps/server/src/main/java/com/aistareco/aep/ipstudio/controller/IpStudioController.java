package com.aistareco.aep.ipstudio.controller;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPricingDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpProjectSummaryDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPublishResultDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpRunDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpStylePresetDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpTemplateDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpUploadResultDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpCreateProjectRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpPublishRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpRunNodeRequest;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpUpdateProjectRequest;
import com.aistareco.aep.ipstudio.service.IpCatalogService;
import com.fasterxml.jackson.databind.JsonNode;
import com.aistareco.aep.ipstudio.service.IpDemoTemplateService;
import com.aistareco.aep.ipstudio.service.IpProjectService;
import com.aistareco.aep.ipstudio.service.IpPublishService;
import com.aistareco.aep.ipstudio.service.IpRunService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import org.springframework.security.core.Authentication;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/**
 * AI IP 工作台（apps/web-ipstudio）。
 *
 * <p>挂在 {@code /api/v1/**} 下，因此已被 {@code ProductRouteTable} 的
 * {@code any("/api/v1/**", AIAVATAR)} 兜底 —— 共用 aiavatar 开通，不新增产品码。
 * 全部 {@code authenticated}，属主校验统一在 service 层
 * （{@code IpProjectService.required} 是唯一入口）。
 */
@RestController
@RequestMapping("/api/v1/ip-studio")
public class IpStudioController {

    private final IpProjectService projects;
    private final IpRunService runs;
    private final IpPublishService publish;
    private final IpCatalogService catalog;
    private final com.aistareco.aep.service.AiModelInvocationService invocation;
    private final com.aistareco.aep.service.materialvideo.MaterialVideoModelClient videoModels;
    private final com.aistareco.aep.service.materialvideo.MaterialVideoJobService videoJobs;
    private final IpDemoTemplateService demos;
    private final com.aistareco.aep.security.InAppOperatorGuard operatorGuard;
    private final com.aistareco.aep.ipstudio.service.IpTemplateResolver templateResolver;
    private final com.aistareco.aep.service.storage.FileStorageService storage;

    public IpStudioController(IpProjectService projects,
                              IpRunService runs,
                              IpPublishService publish,
                              IpCatalogService catalog,
                              com.aistareco.aep.service.AiModelInvocationService invocation,
                              com.aistareco.aep.service.materialvideo.MaterialVideoModelClient videoModels,
                              com.aistareco.aep.service.materialvideo.MaterialVideoJobService videoJobs,
                              IpDemoTemplateService demos,
                              com.aistareco.aep.security.InAppOperatorGuard operatorGuard,
                              com.aistareco.aep.ipstudio.service.IpTemplateResolver templateResolver,
                              com.aistareco.aep.service.storage.FileStorageService storage) {
        this.projects = projects;
        this.runs = runs;
        this.publish = publish;
        this.catalog = catalog;
        this.invocation = invocation;
        this.videoModels = videoModels;
        this.videoJobs = videoJobs;
        this.demos = demos;
        this.operatorGuard = operatorGuard;
        this.templateResolver = templateResolver;
        this.storage = storage;
    }

    // ── 目录 ──────────────────────────────────────────────────

    /** 全局**实例**（带素材的成品）—— 画布列表里那一批「官方示例」。 */
    @GetMapping("/demos/examples")
    public ApiResponse<List<IpTemplateDto>> demoExamples() {
        return ApiResponse.of(templateResolver.listExamples());
    }

    /**
     * 「开始一个 IP」那一排 = 内置模板 + 全局**模板**（只有工作流，素材不跟着走）。
     * 带素材的实例不在这里，见 {@code GET /demos/examples}。
     */
    @GetMapping("/templates")
    public ApiResponse<List<IpTemplateDto>> templates() {
        // 与「按 id 建项目」共用 IpTemplateResolver —— 列表和建项目必须读同一套来源，
        // 否则就是目录里点得到、建的时候说不存在（v0.192 修的正是这个）。
        return ApiResponse.of(templateResolver.list());
    }

    private String signOrEmpty(String key) {
        try {
            String url = storage.signedUrl(key);
            return url == null ? "" : url;
        } catch (RuntimeException e) {
            return "";   // 封面签不出来只是少一张缩略图，不该让整个目录挂掉
        }
    }

    /**
     * 把自己的项目存成**全局示例**（运营）。素材会复制一份到平台自有目录，
     * 之后作者继续改项目、甚至删项目，示例都不受影响。
     * body: {@code { demoId?, name?, summary?, kind? }} —— 带已有 demoId 就是更新那一条。
     * {@code kind}：{@code template}（只共享工作流，素材剥掉）或 {@code example}
     * （连素材的成品，默认）。两者落点不同 —— 模板进「开始一个 IP」，实例进画布列表。
     */
    @PostMapping("/projects/{id}/publish-as-demo")
    public ApiResponse<JsonNode> publishAsDemo(Authentication auth, Principal principal,
                                               @PathVariable String id,
                                               @RequestBody(required = false) JsonNode body) {
        // 发布是**推给全平台每一个用户**的动作：一键生效、无复核、素材还会复制进平台
        // 自有存储长期留着。所以要超管，不是任一运营（v0.192 收敛）。
        operatorGuard.requireSuperAdmin(auth, "发布全局示例会出现在所有用户的工作流目录里，仅超级管理员可操作。");
        String kind = text(body, "kind");
        var row = demos.publishFromProject(uid(principal), id,
                text(body, "demoId"), text(body, "name"), text(body, "summary"),
                com.aistareco.aep.ipstudio.model.IpDemoTemplate.KIND_TEMPLATE.equals(kind)
                        ? com.aistareco.aep.ipstudio.model.IpDemoTemplate.KIND_TEMPLATE
                        : com.aistareco.aep.ipstudio.model.IpDemoTemplate.KIND_EXAMPLE);
        com.fasterxml.jackson.databind.node.ObjectNode out = ((com.fasterxml.jackson.databind.node.ObjectNode)
                com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode());
        out.put("id", row.getId());
        out.put("name", row.getName());
        out.put("enabled", row.isEnabled());
        out.put("kind", row.getKind());
        return ApiResponse.of(out);
    }

    /**
     * 运营后台：全部全局内容（**含已下线的**）。
     *
     * <p>目录那两个接口只查启用中的 —— 那是给用户看的。运营要看的是全集：
     * 下线之后如果哪儿都看不见，就等于「下线 = 消失」，想重新上线只能自己记住 demoId。
     */
    @GetMapping("/demos")
    public ApiResponse<List<com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpDemoAdminDto>> listDemos(
            Authentication auth) {
        operatorGuard.require(auth, "仅平台运营可查看全局内容管理列表。");
        return ApiResponse.of(demos.listForAdmin());
    }

    /**
     * 改展示信息：名字 / 说明 / 排序（运营）。
     *
     * <p>排序是「开始一个 IP」那一排的先后 —— 新用户的第一印象，本来就该能调；
     * 此前 {@code sortOrder} 有字段却没有任何地方能设，恒为 0。
     */
    @PostMapping("/demos/{demoId}")
    public ApiResponse<JsonNode> updateDemo(Authentication auth, @PathVariable String demoId,
                                            @RequestBody(required = false) JsonNode body) {
        operatorGuard.require(auth, "仅平台运营可编辑全局内容。");
        Integer sortOrder = body != null && body.hasNonNull("sortOrder")
                ? body.path("sortOrder").asInt() : null;
        var row = demos.updateMeta(demoId, text(body, "name"), text(body, "summary"), sortOrder);
        com.fasterxml.jackson.databind.node.ObjectNode out =
                com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        out.put("id", row.getId());
        out.put("name", row.getName());
        out.put("sortOrder", row.getSortOrder());
        return ApiResponse.of(out);
    }

    /**
     * 删掉一条全局内容，连它自己那份素材副本一起（超管）。
     *
     * <p>要超管而不是运营：这一步**不可逆、也没有回收站**，而下线已经足以止血。
     * 「难删除、易下线」与发布那条「难发布、易撤回」是同一条分寸。
     */
    @DeleteMapping("/demos/{demoId}")
    public ApiResponse<JsonNode> deleteDemo(Authentication auth, @PathVariable String demoId) {
        operatorGuard.requireSuperAdmin(auth,
                "删除全局内容会连同素材副本一起清掉且不可恢复，仅超级管理员可操作。先「下线」同样能让用户看不到。");
        demos.deleteDemo(demoId);
        com.fasterxml.jackson.databind.node.ObjectNode out =
                com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        out.put("id", demoId);
        out.put("deleted", true);
        return ApiResponse.of(out);
    }

    /** 下线 / 重新上线一个全局示例（运营）。不删数据。 */
    @PostMapping("/demos/{demoId}/enabled")
    public ApiResponse<JsonNode> setDemoEnabled(Authentication auth, @PathVariable String demoId,
                                                @RequestBody(required = false) JsonNode body) {
        // 下线**故意维持运营级**：撤掉一个不合适的示例应当尽量容易 ——
        // 为了删掉一个尴尬的东西还得先找到超管，只会让它在线上多挂几天。
        operatorGuard.require(auth, "仅平台运营可下线全局示例工作流。");
        boolean enabled = body == null || !body.has("enabled") || body.path("enabled").asBoolean(true);
        demos.setEnabled(demoId, enabled);
        com.fasterxml.jackson.databind.node.ObjectNode out =
                com.fasterxml.jackson.databind.node.JsonNodeFactory.instance.objectNode();
        out.put("id", demoId);
        out.put("enabled", enabled);
        return ApiResponse.of(out);
    }

    private static String text(JsonNode body, String field) {
        if (body == null) return null;
        JsonNode v = body.path(field);
        return v.isTextual() && !v.asText().isBlank() ? v.asText().trim() : null;
    }

    @GetMapping("/styles")
    public ApiResponse<List<IpStylePresetDto>> styles() {
        return ApiResponse.of(catalog.styles());
    }

    @GetMapping("/pricing")
    public ApiResponse<IpPricingDto> pricing() {
        return ApiResponse.of(runs.pricingDto());
    }

    /**
     * 画布上的模型下拉。
     *
     * <p>候选来自后台配好的端点（{@code AiAppBinding} + {@code ai_app_endpoint_candidate}），
     * **不是用户自己填的 Key** —— 这跟短剧线 {@code GET /me/drama/render/models} 是同一个形态。
     * 一个都没配时返回空数组，前端据此提示「尚未开通」并禁用生成，不假装能跑（§8.0）。
     */
    @GetMapping("/models")
    public ApiResponse<com.aistareco.aep.dto.RenderModelsDto> models() {
        // 用途必须与实际跑的那条链一致：画布出图走 DAP_IMAGE（dap 生成链），
        // 出视频走 VIDEO_GENERATION（通用视频链）。列错用途 = 列出一批点了不生效的模型。
        return ApiResponse.of(new com.aistareco.aep.dto.RenderModelsDto(
                modelOptions(com.aistareco.aep.model.AiModelPurpose.DAP_IMAGE, runs.pricingDto().imageCredits()),
                modelOptions(com.aistareco.aep.model.AiModelPurpose.VIDEO_GENERATION, 0)));
    }

    private java.util.List<com.aistareco.aep.dto.RenderModelsDto.RenderModelOptionDto> modelOptions(
            com.aistareco.aep.model.AiModelPurpose purpose, long defaultCost) {
        boolean video = purpose == com.aistareco.aep.model.AiModelPurpose.VIDEO_GENERATION;
        java.util.List<com.aistareco.aep.dto.RenderModelsDto.RenderModelOptionDto> out = new java.util.ArrayList<>();
        for (var r : invocation.listCandidates(purpose)) {
            if (!r.candidate().isEnabled() || !r.endpoint().isEnabled()) continue;
            long cost = r.candidate().getCreditCostOverride() != null
                    ? r.candidate().getCreditCostOverride() : defaultCost;
            // 视频候选带上**有效**时长区间（协议硬边界 ∩ 候选配置）——
            // 下限只有协议知道（聚算媒体 5 秒起），后台那张表里根本没有这一列。
            // 不给的话画布的时长滑杆是 4–30，用户选个 4 秒点发送就撞 400。
            var caps = video
                    ? capabilityWithDuration(r)
                    : com.aistareco.aep.dto.EndpointCapabilityDto.from(r.candidate());
            out.add(new com.aistareco.aep.dto.RenderModelsDto.RenderModelOptionDto(
                    r.endpoint().getId(), r.endpoint().getName(), r.isDefault(),
                    caps, cost, video ? "per_video" : "per_image"));
        }
        return out;
    }

    private com.aistareco.aep.dto.EndpointCapabilityDto capabilityWithDuration(
            com.aistareco.aep.service.AiModelInvocationService.ResolvedEndpoint r) {
        try {
            var b = videoModels.effectiveDurationBounds(r.endpoint().getId(), r.endpoint());
            // 画幅同理：聚算协议只有 768p + 横/竖两档，界面却照搬了上游的
            // 480p/720p/1080p × 六种比例 —— 不告诉前端的话，用户选「720p·3:4」
            // 拿回来的是 768×1376，而没有任何地方说过为什么（v0.184）。
            return com.aistareco.aep.dto.EndpointCapabilityDto.from(
                    r.candidate(), b.minSec(), b.maxSec(), videoModels.videoGeometry(r.endpoint()));
        } catch (RuntimeException e) {
            // 拿不到区间不该让整个模型下拉挂掉 —— 退回「未知区间」，前端按默认范围显示
            return com.aistareco.aep.dto.EndpointCapabilityDto.from(r.candidate());
        }
    }

    /**
     * 按存储键重签图片地址。
     *
     * <p>签名有 TTL（默认一小时），而画布是一开就是半天的工具 —— 编辑到一半图全裂掉，
     * 用户只会以为东西丢了。前端发现图加载失败时拿 key 回来换一批新地址。
     *
     * <p>只签**本人的** key：画布文档是客户端拥有的，客户端能往里塞任何字符串。
     */
    @PostMapping("/assets/sign")
    public ApiResponse<java.util.Map<String, String>> sign(Principal principal,
                                                           @RequestBody SignRequest req) {
        return ApiResponse.of(projects.signOwnedKeys(uid(principal), req == null ? null : req.keys()));
    }

    public record SignRequest(java.util.List<String> keys) {}

    // ── 上传 ──────────────────────────────────────────────────

    @PostMapping("/uploads")
    public ApiResponse<IpUploadResultDto> upload(Principal principal,
                                                 @RequestPart("file") MultipartFile file) {
        return ApiResponse.of(projects.upload(uid(principal), file));
    }

    // ── 项目 ──────────────────────────────────────────────────

    @GetMapping("/projects")
    public ApiResponse<List<IpProjectSummaryDto>> list(Principal principal) {
        return ApiResponse.of(projects.list(uid(principal)));
    }

    @PostMapping("/projects")
    public ApiResponse<IpProjectDto> create(Principal principal,
                                            @RequestBody(required = false) IpCreateProjectRequest req) {
        return ApiResponse.of(projects.create(uid(principal), req));
    }

    @GetMapping("/projects/{id}")
    public ApiResponse<IpProjectDto> detail(Principal principal, @PathVariable String id) {
        return ApiResponse.of(projects.detail(uid(principal), id));
    }

    @PutMapping("/projects/{id}")
    public ApiResponse<IpProjectDto> update(Principal principal, @PathVariable String id,
                                            @RequestBody IpUpdateProjectRequest req) {
        return ApiResponse.of(projects.update(uid(principal), id, req));
    }

    @DeleteMapping("/projects/{id}")
    public ApiResponse<Map<String, Object>> remove(Principal principal, @PathVariable String id) {
        projects.remove(uid(principal), id);
        return ApiResponse.of(Map.of("id", id, "deleted", true));
    }

    // ── 运行 ──────────────────────────────────────────────────

    @PostMapping("/projects/{id}/nodes/{nodeId}/run")
    public ApiResponse<IpRunDto> run(Principal principal,
                                     @PathVariable String id,
                                     @PathVariable String nodeId,
                                     @RequestBody(required = false) IpRunNodeRequest req) {
        return ApiResponse.of(runs.run(uid(principal), id, nodeId, req));
    }

    /**
     * 画布出图。参考图由画布点名（它才知道用户框了哪几张），服务端管归属闸、
     * 提示词模板、模型白名单、计价与冻结结算。
     */
    @PostMapping("/projects/{id}/generate")
    public ApiResponse<IpRunDto> generate(Principal principal, @PathVariable String id,
                                          @RequestBody IpRunService.IpGenerateRequest req) {
        return ApiResponse.of(runs.generate(uid(principal), id, req));
    }

    /**
     * 画布出视频。走通用视频链（分区 ipstudio），不依赖数字人形象 ——
     * dap 的衍生视频要求先发布，而画布上人往往还没发布就想让一张图动起来。
     */
    @PostMapping("/projects/{id}/generate-video")
    public ApiResponse<com.fasterxml.jackson.databind.JsonNode> generateVideo(
            Principal principal, @PathVariable String id,
            @RequestBody IpRunService.IpVideoRequest req) {
        return ApiResponse.of(runs.generateVideo(uid(principal), id, req));
    }

    /**
     * 画布视频任务的进度 / 结果。
     *
     * <p>放在 ip-studio 域下而不是复用带货线的 {@code GET /api/material/videos/jobs/{id}}：
     * 那个接口把 app 写死成 {@code APP_CELEBRITY}（v0.108 分区，防止两条产品线互相串号），
     * 拿它查画布的任务只会「查不到」。此前前端轮询的是一条**根本不存在的**路径
     * {@code /api/me/material/videos/jobs/{id}} —— openapi 里有、controller 里没有，
     * 于是先被开通闸判成「未登记的业务路由」403，修好路由也还是 404（v0.177）。
     *
     * <p>owner 与 app 双闸都在 {@code getJob} 里：不是本人的、或不是 ipstudio 分区的，一律当不存在。
     */
    @GetMapping("/videos/{jobId}")
    public ApiResponse<com.fasterxml.jackson.databind.JsonNode> videoJob(Principal principal,
                                                                        @PathVariable String jobId) {
        return ApiResponse.of(videoJobs.getJob(jobId, uid(principal),
                com.aistareco.aep.service.materialvideo.MaterialVideoJobService.APP_IPSTUDIO));
    }

    @GetMapping("/runs/{id}")
    public ApiResponse<IpRunDto> run(Principal principal, @PathVariable String id) {
        return ApiResponse.of(runs.get(uid(principal), id));
    }

    @PostMapping("/runs/{id}/cancel")
    public ApiResponse<IpRunDto> cancelRun(Principal principal, @PathVariable String id) {
        return ApiResponse.of(runs.cancel(uid(principal), id));
    }

    // ── 发布 ──────────────────────────────────────────────────

    @PostMapping("/projects/{id}/publish")
    public ApiResponse<IpPublishResultDto> publish(Principal principal, @PathVariable String id,
                                                   @RequestBody IpPublishRequest req) {
        return ApiResponse.of(publish.publish(uid(principal), id, req));
    }

    /**
     * 内置提示词模板（装扮 / 表情 / 短动作）。
     *
     * <p>这是「形象卡五字段」通用化之后的替代品：模板是<b>一段完整提示词</b>，
     * 不是字段结构 —— 见 docs/ip-studio-generalize-proposal.md。
     */
    @GetMapping("/prompt-presets")
    public ApiResponse<List<com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPromptGroupDto>> promptPresets() {
        return ApiResponse.of(catalog.promptPresets());
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }
}
