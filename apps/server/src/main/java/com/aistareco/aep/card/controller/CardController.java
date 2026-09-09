package com.aistareco.aep.card.controller;

import com.aistareco.aep.card.model.CardProfile;
import com.aistareco.aep.card.service.CardPersonaService;
import com.aistareco.aep.card.service.CardService;
import com.fasterxml.jackson.databind.JsonNode;
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
    private final CardPersonaService persona;

    public CardController(CardService cards, CardPersonaService persona) {
        this.cards = cards;
        this.persona = persona;
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

    // ── 人设（AI 对话式编辑）─────────────────────────────────────────────────
    //
    // 名片上那些字段说的是「他做过什么」，人设说的是「他是谁」—— 在意什么、怎么说话。
    // `voice` 不是装饰：rewrite 按它重写访客看得见的文案，将来数字人开口也按它来。
    //
    // 上下文由**客户端**带上来（名片文档是客户端拥有、服务端整存整取的，见 CardService），
    // 这里只做归属校验 + 调模型；不落库 —— 用户满意了才由 PUT /{id} 存进文档。
    // 免费：没有 hold / commit，也不写账本（一次对话的成本远低于一次出图，
    // 加计费反而会让人不敢多聊两句，而多聊两句正是这个功能有用的前提）。

    /** 入口侧的历史条数上限（service 里还会再截到最后 24 条喂模型）。 */
    private static final int MAX_HISTORY_IN = 200;

    public record PersonaChatRequest(Map<String, Object> context, List<Map<String, String>> history, String message) {}

    /** 一轮人设对话。返回 {reply, ready, draft?}。 */
    @PostMapping("/{id}/persona/chat")
    public ApiResponse<JsonNode> personaChat(Principal principal, @PathVariable String id,
                                             @RequestBody PersonaChatRequest req) {
        cards.required(uid(principal), id); // 归属闸：不是你的名片，连聊都不给聊
        if (req == null || req.message() == null || req.message().isBlank()) {
            throw BusinessException.badRequest("CARD_PERSONA_MESSAGE_REQUIRED", "说点什么才能接着聊");
        }
        // 入口就把体量卡住：截断发生在 service 里、反序列化之后，那时超大 body 已经进内存了。
        // 这里只挡明显过量的，正常聊天离上限差得远。
        if (req.message().length() > CardPersonaService.MAX_MSG_CHARS) {
            throw BusinessException.badRequest("CARD_PERSONA_MESSAGE_TOO_LONG",
                    "一次说太多了（超过 " + CardPersonaService.MAX_MSG_CHARS + " 字），分几句说。");
        }
        if (req.history() != null && req.history().size() > MAX_HISTORY_IN) {
            throw BusinessException.badRequest("CARD_PERSONA_HISTORY_TOO_LONG", "对话太长了，重新开一段。");
        }
        Map<String, Object> ctx = req.context() == null ? Map.of() : req.context();
        return ApiResponse.of(persona.chat(ctx, req.history(), req.message()));
    }

    public record PersonaRewriteRequest(Map<String, Object> context) {}

    /** 按已定人设重写「一句话 / 能提供 / 在找」。只改说法，不改事实。 */
    @PostMapping("/{id}/persona/rewrite")
    public ApiResponse<JsonNode> personaRewrite(Principal principal, @PathVariable String id,
                                                @RequestBody PersonaRewriteRequest req) {
        cards.required(uid(principal), id);
        Map<String, Object> ctx = req == null || req.context() == null ? Map.of() : req.context();
        if (str(ctx.get("persona")).isBlank()) {
            throw BusinessException.badRequest("CARD_PERSONA_REQUIRED", "先把人设聊出来，才能按它改写文案");
        }
        return ApiResponse.of(persona.rewrite(ctx));
    }

    private static String str(Object v) {
        return v == null ? "" : String.valueOf(v);
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
