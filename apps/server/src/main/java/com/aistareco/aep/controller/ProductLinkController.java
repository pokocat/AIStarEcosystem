package com.aistareco.aep.controller;

import com.aistareco.aep.dto.ProductLinkInfoDto;
import com.aistareco.aep.dto.ProductLinkParseRequest;
import com.aistareco.aep.service.ProductLinkService;
import com.aistareco.common.ApiResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

/**
 * 商品链接「仅解析」端点（v0.31 起）。
 *
 * 仅保留 POST /api/me/products/parse-link，**不落库** —— 任何已登录用户都可用于
 * 链接预览（admin 端 ProductFormDialog 也用此端点做实时回填）。
 *
 * v0.31 之前同时承载了 from-link / refresh-images 两个写端点：因「商品库公共池 +
 * admin 写」决策，这两个写动作已迁移至 {@link AdminProductsController}，路径分别
 * 为 /api/admin/products/from-link 与 /api/admin/products/{id}/refresh-images，
 * 只允许 SUPER_ADMIN / OPERATOR 调用。
 *
 * 挂在 /api/me/** 是因为 AepSecurityConfig 的 .requestMatchers("/api/me/**").authenticated()
 * 强制登录，防 SSRF 滥用（参数 url 会被服务端发起 HTTP 抓取）。
 */
@RestController
@RequestMapping("/api/me/products")
public class ProductLinkController {

    private final ProductLinkService productLinkService;

    public ProductLinkController(ProductLinkService productLinkService) {
        this.productLinkService = productLinkService;
    }

    /** 仅解析，不落库；前端 admin 商品建档 dialog 用此端点回填字段。 */
    @PostMapping("/parse-link")
    public ApiResponse<ProductLinkInfoDto> parseLink(@RequestBody ProductLinkParseRequest req,
                                                     Principal principal) {
        return ApiResponse.of(productLinkService.parse(req == null ? null : req.url()));
    }
}
