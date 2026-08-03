package com.aistareco.aep.dap.controller;

import com.aistareco.aep.dap.dto.DapAssetDtos.ComposeOptionsDto;
import com.aistareco.aep.dap.dto.DapAssetDtos.CompositionDto;
import com.aistareco.aep.dap.dto.DapAssetRequests.CreateCompositionRequest;
import com.aistareco.aep.dap.service.DapCompositionService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;
import java.util.List;
import java.util.Map;

/** 数字资产平台 · 跨资产合成（/api/v1/compositions/**）。 */
@RestController
@RequestMapping("/api/v1/compositions")
public class DapCompositionController {

    private final DapCompositionService compositions;

    public DapCompositionController(DapCompositionService compositions) {
        this.compositions = compositions;
    }

    private static String uid(Principal p) {
        if (p == null) throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录");
        return p.getName();
    }

    /** 出片设置的可选项与单价（画幅 / 出图数量区间 / 单价 / 可用风格模板）。 */
    @GetMapping("/options")
    public ApiResponse<ComposeOptionsDto> options(Principal principal) {
        return ApiResponse.of(compositions.options(uid(principal)));
    }

    @GetMapping
    public ApiResponse<List<CompositionDto>> list(Principal principal,
                                                  @RequestParam(required = false) String ipId) {
        return ApiResponse.of(compositions.list(uid(principal), ipId));
    }

    /** 提交合成（授权核对 → 建单 → 异步出片）→ { composition, job }。 */
    @PostMapping
    public ApiResponse<Map<String, Object>> create(Principal principal,
                                                   @RequestBody CreateCompositionRequest req) {
        return ApiResponse.of(compositions.create(uid(principal), req));
    }

    @GetMapping("/{id}")
    public ApiResponse<CompositionDto> get(Principal principal, @PathVariable String id) {
        return ApiResponse.of(compositions.get(uid(principal), id));
    }
}
