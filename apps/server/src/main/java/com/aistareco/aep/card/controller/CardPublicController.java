package com.aistareco.aep.card.controller;

import com.aistareco.aep.card.service.CardService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 名片公开读。<b>匿名可访问</b> —— 见客户扫码就得能打开，不能要求先注册。
 *
 * <p>放行需要三处同时成立，少一处就 403：
 * <ol>
 *   <li>{@code AepSecurityConfig}：{@code GET /api/v1/card/p/**} permitAll，
 *       且必须排在 {@code /api/v1/**} authenticated <b>之前</b>（顺序敏感）；</li>
 *   <li>{@code ProductRouteTable.PUBLIC_GETS}：登记后才不过开通闸，
 *       否则会出现「匿名 200 / 已登录但没开通 aiavatar 反而 403」的倒挂；</li>
 *   <li>{@link CardService#publicBySlug}：只吐已发布且未软删的名片。</li>
 * </ol>
 *
 * <p>写路径（建卡 / 编辑 / 发布）二期再开，届时走 {@code /api/v1/card/**}，
 * 由 {@code any("/api/v1/**", AIAVATAR)} 兜底照常需要登录 + 开通。
 */
@RestController
@RequestMapping("/api/v1/card")
public class CardPublicController {

    private final CardService cards;

    public CardPublicController(CardService cards) {
        this.cards = cards;
    }

    @GetMapping("/p/{slug}")
    public ApiResponse<Map<String, Object>> publicCard(@PathVariable String slug) {
        return ApiResponse.of(cards.publicBySlug(slug));
    }
}
