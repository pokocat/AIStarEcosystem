package com.aistareco.aep.card.controller;

import com.aistareco.aep.card.model.CardProfile;
import com.aistareco.aep.card.service.CardService;
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
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 名片的写路径（建卡 / 保存 / 发布）。
 *
 * <p>全部 {@code authenticated} —— 挂在 {@code /api/v1/**} 下，被
 * {@code ProductRouteTable} 的 {@code any("/api/v1/**", AIAVATAR)} 兜底，
 * 共用 aiavatar 开通，不新增产品码。属主校验统一在
 * {@link CardService#required} 一处。
 *
 * <p>公开读在 {@link CardPublicController}，是这条路由里唯一豁免登录的一段。
 */
@RestController
@RequestMapping("/api/v1/card")
public class CardController {

    private final CardService cards;

    public CardController(CardService cards) {
        this.cards = cards;
    }

    /** 我的名片列表。一个账号可以有多张 —— 对外身份可能不止一个。 */
    @GetMapping("/mine")
    public ApiResponse<List<CardSummary>> mine(Principal principal) {
        return ApiResponse.of(cards.listMine(uid(principal)).stream().map(CardSummary::from).toList());
    }

    /**
     * 某个数字人形象被哪些名片用了。数字资产详情页的「已用于 · 名片」读这条。
     *
     * <p>放在 card 侧而不是 dap 侧：card 已经依赖 dap（发布时写用量），
     * 反过来再让 dap 依赖 card 就成环了。
     */
    @GetMapping("/by-avatar/{avatarId}")
    public ApiResponse<List<CardSummary>> byAvatar(Principal principal, @PathVariable String avatarId) {
        String uid = uid(principal);
        return ApiResponse.of(cards.affectedByAvatar(avatarId).stream()
                .filter(c -> c.getOwnerUserId().equals(uid))
                .map(CardSummary::from).toList());
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> detail(Principal principal, @PathVariable String id) {
        return ApiResponse.of(cards.detail(uid(principal), id));
    }

    @PostMapping
    public ApiResponse<CardSummary> create(Principal principal, @RequestBody CardWriteRequest req) {
        CardProfile c = cards.create(uid(principal), req.slug(), req.avatarId(), req.doc());
        return ApiResponse.of(CardSummary.from(c));
    }

    /**
     * 从数字人形象一键建卡（草稿）。
     *
     * <p>名字与整柜造型自动带过来 —— 用户在工作台已经起过名、跑过一套装扮和表情，
     * 不该再让他填一遍。回来的是草稿：发布是显式动作，一键不能把人的联系方式挂上公网。
     */
    @PostMapping("/from-avatar")
    public ApiResponse<CardSummary> createFromAvatar(Principal principal,
                                                     @RequestBody FromAvatarRequest req) {
        CardProfile c = cards.createFromAvatar(uid(principal), req.avatarId(), req.slug());
        return ApiResponse.of(CardSummary.from(c));
    }

    public record FromAvatarRequest(String avatarId, String slug) {}

    @PutMapping("/{id}")
    public ApiResponse<CardSummary> save(Principal principal, @PathVariable String id,
                                         @RequestBody CardWriteRequest req) {
        CardProfile c = cards.save(uid(principal), id, req.slug(), req.avatarId(), req.doc());
        return ApiResponse.of(CardSummary.from(c));
    }

    /** 发布后匿名可读，所以这一步会做内容闸（名字 / 身份必填）。 */
    @PostMapping("/{id}/publish")
    public ApiResponse<CardSummary> publish(Principal principal, @PathVariable String id) {
        return ApiResponse.of(CardSummary.from(cards.publish(uid(principal), id)));
    }

    @PostMapping("/{id}/unpublish")
    public ApiResponse<CardSummary> unpublish(Principal principal, @PathVariable String id) {
        return ApiResponse.of(CardSummary.from(cards.unpublish(uid(principal), id)));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Map<String, Object>> delete(Principal principal, @PathVariable String id) {
        cards.softDelete(uid(principal), id);
        return ApiResponse.of(Map.of("deleted", true));
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }

    /** 写入请求。{@code doc} 是整存整取的名片文档，服务端逐字保存不改写。 */
    public record CardWriteRequest(String slug, String avatarId, Map<String, Object> doc) {}

    /** 列表 / 写入的回执。完整文档走 {@code GET /{id}}，列表不带文档避免一次拉一堆。 */
    public record CardSummary(String id, String slug, String regNo, String status,
                              String avatarId, String publicUrl,
                              Instant publishedAt, Instant updatedAt) {
        public static CardSummary from(CardProfile c) {
            return new CardSummary(c.getId(), c.getSlug(), c.getRegNo(), c.getStatus(),
                    c.getAvatarId(), "/card/p/" + c.getSlug(),
                    c.getPublishedAt(), c.getUpdatedAt());
        }
    }
}
