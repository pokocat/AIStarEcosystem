package com.aistareco.aep.ipstudio.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;

/**
 * AI IP 工作台 wire DTO —— 字段名与 {@code packages/types/src/ip-studio.ts} 1:1
 * （docs/ip-studio-plan.md §2 是契约真源）。
 *
 * <p>文件字段的 DB 真值一律是 storage key；这里出现的 {@code url} / {@code coverUrl}
 * 都是出 wire 时由 {@code FileStorageService.signedUrl(key)} 派生的短期签名地址，
 * **不落库**（§4.7.4 / §4.7.5）。
 *
 * <p>{@code doc} / {@code inputs} / {@code output} 用 {@code JsonNode} 原样透传：
 * 画布文档由客户端拥有，服务端不该为了「有个 Java 类型」而把它拆成一堆 record
 * —— 那只会让每次前端加字段都要改后端。
 */
public final class IpStudioDtos {

    private IpStudioDtos() {}

    /** 项目卡（列表用）。 */
    public record IpProjectSummaryDto(String id, String name, String templateId, String status,
                                      String coverUrl, String publishedAvatarId,
                                      String createdAt, String updatedAt) {}

    /**
     * 项目详情。
     *
     * @param runs     nodeId → 该节点最近一次运行的投影
     * @param runsById runId → 运行；含 {@code runs} 里的全部，外加 doc 里被 generate 节点
     *                 {@code selectedRunId} 显式选中、却已不是最新的那次（否则画布上的选中图会变空白）
     */
    public record IpProjectDto(String id, String name, String templateId, String status,
                               String coverUrl, String publishedAvatarId,
                               String createdAt, String updatedAt,
                               JsonNode doc, Map<String, IpRunDto> runs,
                               Map<String, IpRunDto> runsById) {}

    /** 一次运行。{@code cost} 恒为真实账本值（running=冻结额 / done=已提交之和）。 */
    public record IpRunDto(String id, String projectId, String nodeId, String kind,
                           String status, String stage, int pct, long cost,
                           String errorCode, String errorMessage,
                           JsonNode inputs, JsonNode output,
                           String createdAt, String finishedAt) {}

    /** 内置工作流模板（resources/ipstudio/templates/*.json）。 */
    public record IpTemplateDto(String id, String name, String summary, String coverUrl,
                                String stylePresetId, int lookCount, long estimatedCredits,
                                JsonNode doc) {}

    /** 内置风格预设（resources/ipstudio/styles.json）。 */
    public record IpStylePresetDto(String id, String name, String summary,
                                   String promptEn, String negativeEn, String coverUrl) {}

    /** 单价（后台可配，前端展示预估用）。 */
    public record IpPricingDto(long identityCredits, long imageCredits) {}

    /** 上传结果。key 是真值，url 是短期签名派生值。 */
    public record IpUploadResultDto(String key, String url, Integer width, Integer height,
                                    String fileName) {}

    /** 发布结果。 */
    public record IpPublishResultDto(String avatarId, List<String> lookIds) {}
}
