package com.aistareco.aep.controller;

import com.aistareco.aep.dto.MusicGenJobDto;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.service.AiModelInvocationService;
import com.aistareco.aep.service.music.MusicGenJobService;
import com.aistareco.common.ApiResponse;
import com.aistareco.common.BusinessException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.Principal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 音乐生成：/api/me/music/*。全部要求登录，且只能看到自己的任务。
 */
@RestController
@RequestMapping("/api/me/music")
public class MusicGenController {

    private final MusicGenJobService jobService;
    private final AiModelInvocationService invocation;

    public MusicGenController(MusicGenJobService jobService, AiModelInvocationService invocation) {
        this.jobService = jobService;
        this.invocation = invocation;
    }

    /** 下单生成。注意：请求体里任何计费相关字段都不接受，单价一律服务端算。 */
    @PostMapping("/generate")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ApiResponse<MusicGenJobDto> generate(Principal principal,
                                                @RequestBody Map<String, Object> body) {
        String owner = requireUser(principal);
        var spec = new MusicGenJobService.CreateSpec(
                str(body.get("clientRequestId")),
                str(body.get("artistId")),
                str(body.get("prompt")),
                str(body.get("lyrics")),
                str(body.get("genre")),
                str(body.get("mood")),
                str(body.get("timbre")),
                str(body.get("gender")),
                bool(body.get("instrumental")),
                intOr(body.get("durationSec"), 0),
                str(body.get("endpointId"))
        );
        return ApiResponse.of(jobService.submit(spec, owner));
    }

    @GetMapping("/jobs")
    public ApiResponse<List<MusicGenJobDto>> listJobs(Principal principal) {
        return ApiResponse.of(jobService.listJobs(requireUser(principal)));
    }

    @GetMapping("/jobs/{id}")
    public ApiResponse<MusicGenJobDto> getJob(Principal principal, @PathVariable String id) {
        MusicGenJobDto dto = jobService.getJob(id, requireUser(principal));
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "任务不存在");
        }
        return ApiResponse.of(dto);
    }

    /**
     * 可选模型列表 —— 前端「出曲模型」下拉据此渲染。
     * 一个候选都没有时返回空数组，前端据此提示「尚未配置」，而不是显示假选项。
     */
    @GetMapping("/models")
    public ApiResponse<List<Map<String, Object>>> models() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (var c : invocation.listCandidates(AiModelPurpose.MUSIC_GENERATION)) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("endpointId", c.endpoint().getId());
            m.put("name", c.endpoint().getName());
            m.put("model", c.endpoint().getModel());
            m.put("isDefault", c.isDefault());
            m.put("maxDurationSec", c.candidate() == null ? null : c.candidate().getMaxDurationSec());
            out.add(m);
        }
        return ApiResponse.of(out);
    }

    private static String requireUser(Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new BusinessException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "请先登录。");
        }
        return principal.getName();
    }

    private static String str(Object v) {
        return v == null ? null : v.toString();
    }

    private static boolean bool(Object v) {
        if (v instanceof Boolean b) return b;
        return v != null && "true".equalsIgnoreCase(v.toString());
    }

    private static int intOr(Object v, int fallback) {
        if (v instanceof Number n) return n.intValue();
        if (v == null) return fallback;
        try {
            return Integer.parseInt(v.toString().trim());
        } catch (Exception e) {
            return fallback;
        }
    }
}
