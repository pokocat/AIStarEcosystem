package com.aistareco.aep.controller;

import com.aistareco.aep.service.DramaRecipeService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

/**
 * 短剧「可复用配方」Recipe（v0.73 抽 skill 飞轮）用户侧 + 运营侧端点。
 *
 * 全部挂 /api/me/drama/recipes/** → authenticated。运营审核 / 发布 **不进 admin 后台**，
 * 维护入口在 web-drama 运营后台（与平台目录 DramaCatalogController 同惯例：JWT 角色
 * OPERATOR / SUPER_ADMIN 才能 review / publish / reject）。
 */
@RestController
@RequestMapping("/api/me/drama/recipes")
public class DramaRecipeController {

    private final DramaRecipeService service;

    public DramaRecipeController(DramaRecipeService service) {
        this.service = service;
    }

    /** 我抽取 / 提交过的配方（含审核状态）。 */
    @GetMapping
    public ApiResponse<List<JsonNode>> listMine(Principal principal) {
        return ApiResponse.of(service.listMine(principal.getName()));
    }

    /** 创意库：已发布配方（任意已登录可见，按套用热度降序）。 */
    @GetMapping("/published")
    public ApiResponse<List<JsonNode>> listPublished() {
        return ApiResponse.of(service.listPublished());
    }

    /** 运营审核队列：待审配方（OPERATOR / SUPER_ADMIN）。 */
    @GetMapping("/review")
    public ApiResponse<List<JsonNode>> listForReview(Authentication auth) {
        requireOperator(auth);
        return ApiResponse.of(service.listForReview());
    }

    /** 运营发布（OPERATOR / SUPER_ADMIN）。 */
    @PostMapping("/{id}/publish")
    public ApiResponse<JsonNode> publish(Authentication auth, @PathVariable String id) {
        requireOperator(auth);
        return ApiResponse.of(service.publish(id));
    }

    /** 运营驳回（OPERATOR / SUPER_ADMIN）。body: { note? } */
    @PostMapping("/{id}/reject")
    public ApiResponse<JsonNode> reject(Authentication auth, @PathVariable String id,
                                        @RequestBody(required = false) JsonNode body) {
        requireOperator(auth);
        String note = body != null && body.hasNonNull("note") ? body.get("note").asText() : null;
        return ApiResponse.of(service.reject(id, note));
    }

    /** 套用已发布配方 → 新建预填项目，返回 { projectId }（前端拿到后跳工作台）。 */
    @PostMapping("/{id}/apply")
    public ApiResponse<JsonNode> apply(Principal principal, @PathVariable String id) {
        return ApiResponse.of(service.applyToNewProject(id, principal.getName()));
    }

    // ── 运营：精选用户作品（双通道之②） + 手建内置（通道③） ──────────────────────

    /** 运营「从用户作品精选」候选池（OPERATOR / SUPER_ADMIN）。 */
    @GetMapping("/candidates")
    public ApiResponse<List<JsonNode>> listCandidates(Authentication auth) {
        requireOperator(auth);
        return ApiResponse.of(service.listCandidates());
    }

    /** 运营对某用户项目发起「邀请精选」（OPERATOR / SUPER_ADMIN）。body: { projectId } */
    @PostMapping("/invite")
    public ApiResponse<JsonNode> invite(Authentication auth, @RequestBody JsonNode body) {
        requireOperator(auth);
        String projectId = body != null && body.hasNonNull("projectId") ? body.get("projectId").asText() : null;
        if (projectId == null || projectId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_PROJECT_ID_REQUIRED", "缺少 projectId。");
        }
        return ApiResponse.of(service.inviteFromProject(projectId, auth.getName()));
    }

    /** 运营手建内置创意（OPERATOR / SUPER_ADMIN），直接发布。 */
    @PostMapping("/builtin")
    public ApiResponse<JsonNode> createBuiltin(Authentication auth, @RequestBody JsonNode body) {
        requireOperator(auth);
        return ApiResponse.of(service.createBuiltin(body, auth.getName()));
    }

    /** 用户对运营邀请授权 / 谢绝。body: { approve: boolean } */
    @PostMapping("/{id}/respond")
    public ApiResponse<JsonNode> respond(Principal principal, @PathVariable String id,
                                         @RequestBody(required = false) JsonNode body) {
        boolean approve = body != null && body.hasNonNull("approve") && body.get("approve").asBoolean();
        return ApiResponse.of(service.respondInvite(id, principal.getName(), approve));
    }

    private static void requireOperator(Authentication auth) {
        boolean ok = auth != null && auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(a -> a.equals("ROLE_OPERATOR") || a.equals("ROLE_SUPER_ADMIN"));
        if (!ok) {
            throw new BusinessException(HttpStatus.FORBIDDEN, "OPERATOR_ONLY", "仅平台运营可审核 / 发布短剧配方。");
        }
    }
}
