package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ProductDto;
import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.aistareco.aep.dto.ProductLinkParseRequest;
import com.aistareco.aep.service.ProductLinkPersistService;
import com.aistareco.aep.service.ProductLinkService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/**
 * 商品链接解析端点（v0.26+）。
 *
 * 挂在 /api/me/products/* 是因为：
 *   1. 受 AepSecurityConfig 的 /api/me/** authenticated 规则保护（防 SSRF 滥用）
 *   2. 解析结果 / Product 落库都是「当前用户名下」语义
 *
 * 两个端点：
 *   POST /api/me/products/parse-link {url}   → 仅解析，不写库（preview）
 *   POST /api/me/products/from-link {url}    → 解析 + 落 Product + 登记 MixcutAsset 图片
 */
@RestController
@RequestMapping("/api/me/products")
public class ProductLinkController {

    private final ProductLinkService productLinkService;
    private final ProductLinkPersistService persistService;

    public ProductLinkController(ProductLinkService productLinkService,
                                 ProductLinkPersistService persistService) {
        this.productLinkService = productLinkService;
        this.persistService = persistService;
    }

    /** 仅解析，不落库。前端 ProductFormDialog 的「📋 从抖音链接解析」用此端点。 */
    @PostMapping("/parse-link")
    public ApiResponse<ProductLinkInfoDto> parseLink(@RequestBody ProductLinkParseRequest req,
                                                     Principal principal) {
        return ApiResponse.of(productLinkService.parse(req == null ? null : req.url()));
    }

    /** 解析 + 落 Product + 登记图片为 MixcutAsset(subkind=product-photo)。 */
    @PostMapping("/from-link")
    public ApiResponse<ProductDto> fromLink(@RequestBody ProductLinkParseRequest req,
                                            Principal principal) {
        String userId = principal == null ? null : principal.getName();
        return ApiResponse.of(persistService.parseAndPersist(req == null ? null : req.url(), userId));
    }
}
