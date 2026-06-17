package com.aistareco.aep.controller;

import com.aistareco.aep.dto.AdminAiModelEndpointUpsertDto;
import com.aistareco.aep.dto.AiModelDiscoveryRequestDto;
import com.aistareco.aep.dto.AiModelDiscoveryResultDto;
import com.aistareco.aep.dto.AiModelEndpointDto;
import com.aistareco.aep.dto.AiModelEndpointKeyMintedDto;
import com.aistareco.aep.dto.AiModelProviderPresetDto;
import com.aistareco.aep.dto.AiModelQualityUpdateDto;
import com.aistareco.aep.dto.AiModelReplayResultDto;
import com.aistareco.aep.dto.AiModelUsageReportDto;
import com.aistareco.aep.dto.AiModelUsageRecordDto;
import com.aistareco.aep.service.AiModelEndpointAdminService;
import com.aistareco.aep.service.AiModelUsageAdminService;
import com.aistareco.aep.service.AiModelUsageService;
import com.aistareco.common.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Admin AI 模型接入端点配置：/api/admin/ai-models/*（v0.41，原 AdminAiModelProviderController）。
 *
 * 路由保留 /api/admin/ai-models（admin 鉴权不依赖路径，省 churn）。
 * 一行端点 = 固定 {上游密钥 + 单模型 + 地址}，并自带外部 API Token（mint-key / revoke-key）。
 * 上游 apiKey / 外部 API Token 永远不在响应中明文返回（mint-key 仅一次返回 plaintext）。
 */
@RestController
@RequestMapping("/api/admin/ai-models")
public class AdminAiModelEndpointController {

    private final AiModelEndpointAdminService service;
    private final AiModelUsageService usageService;
    private final AiModelUsageAdminService usageAdminService;

    public AdminAiModelEndpointController(AiModelEndpointAdminService service,
                                          AiModelUsageService usageService,
                                          AiModelUsageAdminService usageAdminService) {
        this.service = service;
        this.usageService = usageService;
        this.usageAdminService = usageAdminService;
    }

    @GetMapping
    public ApiResponse<List<AiModelEndpointDto>> list() {
        return ApiResponse.of(service.list());
    }

    /** 内置常见大模型服务商预设（火山方舟 / Kimi / DeepSeek / 千问 / OpenAI）。 */
    @GetMapping("/presets")
    public ApiResponse<List<AiModelProviderPresetDto>> presets() {
        return ApiResponse.of(service.listPresets());
    }

    /** 新建前用表单的 baseUrl + apiKey 调服务商 GET /models 拉取可用模型。 */
    @PostMapping("/discover-models")
    public ApiResponse<AiModelDiscoveryResultDto> discoverModels(@RequestBody AiModelDiscoveryRequestDto req) {
        return ApiResponse.of(service.discoverModels(req));
    }

    /**
     * 全局大模型用量报表（v0.41）。
     * days：统计窗口天数，缺省 30，封顶 365。按服务商 + 模型两个维度聚合。
     */
    @GetMapping("/usage")
    public ApiResponse<AiModelUsageReportDto> usage(@RequestParam(required = false) Integer days) {
        return ApiResponse.of(usageService.report(days));
    }

    @GetMapping("/usage-records")
    public ApiResponse<List<AiModelUsageRecordDto>> usageRecords(
            @RequestParam(required = false) Integer days,
            @RequestParam(required = false) String appCode,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String tenantId,
            @RequestParam(required = false) String purpose,
            @RequestParam(required = false) String providerId,
            @RequestParam(required = false) Boolean success,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer size) {
        return ApiResponse.of(usageService.records(days, appCode, userId, tenantId, purpose, providerId, success, q, size));
    }

    @PostMapping("/usage-records/{recordId}/replay")
    public ApiResponse<AiModelReplayResultDto> replayUsageRecord(@PathVariable String recordId) {
        return ApiResponse.of(usageAdminService.replay(recordId));
    }

    @PutMapping("/usage-records/{recordId}/quality")
    public ApiResponse<AiModelUsageRecordDto> updateUsageRecordQuality(@PathVariable String recordId,
                                                                       @RequestBody AiModelQualityUpdateDto body) {
        return ApiResponse.of(usageAdminService.updateQuality(recordId, body));
    }

    @GetMapping("/{id}")
    public ApiResponse<AiModelEndpointDto> get(@PathVariable String id) {
        return ApiResponse.of(service.get(id));
    }

    /** 单服务商用量报表（v0.41）。 */
    @GetMapping("/{id}/usage")
    public ApiResponse<AiModelUsageReportDto> usageForProvider(@PathVariable String id,
                                                               @RequestParam(required = false) Integer days) {
        return ApiResponse.of(usageService.reportForProvider(id, days));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AiModelEndpointDto> create(@RequestBody AdminAiModelEndpointUpsertDto req) {
        return ApiResponse.of(service.create(req));
    }

    @PutMapping("/{id}")
    public ApiResponse<AiModelEndpointDto> update(@PathVariable String id,
                                                  @RequestBody AdminAiModelEndpointUpsertDto req) {
        return ApiResponse.of(service.update(id, req));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    @PostMapping("/{id}/test")
    public ApiResponse<Map<String, Object>> test(@PathVariable String id) {
        return ApiResponse.of(service.testConnection(id));
    }

    /** 已存端点：用落库的 apiKey 重新拉取可用模型（前端拉回后保存写入配置）。 */
    @PostMapping("/{id}/fetch-models")
    public ApiResponse<AiModelDiscoveryResultDto> fetchModels(@PathVariable String id) {
        return ApiResponse.of(service.fetchModels(id));
    }

    /** 给端点铸造（或重铸）外部 API Token，仅一次返回明文。 */
    @PostMapping("/{id}/mint-key")
    public ApiResponse<AiModelEndpointKeyMintedDto> mintKey(@PathVariable String id) {
        return ApiResponse.of(service.mintKey(id));
    }

    /** 撤销端点的外部 API Token（不删端点）。 */
    @PostMapping("/{id}/revoke-key")
    public ApiResponse<AiModelEndpointDto> revokeKey(@PathVariable String id) {
        return ApiResponse.of(service.revokeKey(id));
    }
}
