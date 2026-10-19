package com.aistareco.aep.ipstudio.dto;

import java.util.List;
import java.util.Map;

/** Wire mirror of StudioSkillSummary / StudioSkillLimits and the S3 skill admin / version / dry-run / draft types in packages/types/src/ip-studio-workflow.ts (field names 1:1). */
public final class StudioSkillDtos {
    private StudioSkillDtos() {}
    /** {@code maxSegmentSec} is a positive integer or the string {@code "model"} (read from the selected video model contract). */
    public record SkillLimits(int maxSourceSec, int maxSegments, Object maxSegmentSec, int maxSteps, int maxAutoFixPerSegment) {}
    /** Routing hints from the front matter (S3); {@code null} on the wire when the skill declares none. */
    public record SkillTriggers(List<String> media, List<String> keywords,
                                @com.fasterxml.jackson.annotation.JsonProperty("default") Boolean defaultSkill) {}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record SkillSummary(String key, String name, int version, String status, String planning, String summary,
                               List<String> methodExamples, Map<String, List<String>> operations, SkillLimits limits,
                               List<String> checks, List<String> autoFixChecks, List<String> requiredCapabilities,
                               SkillTriggers triggers) {}

    // ── S3 admin / versions / dry-run / drafts (StudioSkillVersion, StudioSkillAdminItem, … in the TS file) ───────────
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record SkillVersion(String id, String skillKey, int version, String status, String source, String author, String note,
                               String createdAt, Map<String, Object> frontmatter, String bodyMd, Boolean current, Integer baseVersion,
                               String sourceProjectId, String sourceExecutionId, String sourceRunId, String publishedAt) {}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record SkillAdminItem(String key, String name, String status, int currentVersion, String summary, String updatedBy,
                                 String createdAt, String updatedAt, int pendingDrafts, SkillSummary skill, String seedFile) {}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record SkillAdminDetail(String key, String name, String status, int currentVersion, String summary, String updatedBy,
                                   String createdAt, String updatedAt, int pendingDrafts, SkillSummary skill, String seedFile,
                                   SkillVersion current) {}
    public record CreateRequest(String markdown, String note) {}
    /** {@code frontmatter}: YAML text or a JSON object. */
    public record PublishRequest(com.fasterxml.jackson.databind.JsonNode frontmatter, String bodyMd, String note, Integer expectedVersion) {}
    public record StatusRequest(String status) {}
    public record VersionActionRequest(String note, Integer expectedVersion) {}
    public record DryRunAsset(String id, String type, String title, String description, Double durationSec) {}
    public record DryRunRequest(String analysisMarkdown, String brief, String stage, List<DryRunAsset> assets, String endpointId,
                                Integer version, com.fasterxml.jackson.databind.JsonNode frontmatter, String bodyMd) {}
    public record DryRunValidation(boolean ok, List<String> errors) {}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record DryRunUsage(Long inputTokens, Long outputTokens, Long totalTokens) {}
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)
    public record DryRunResult(com.fasterxml.jackson.databind.JsonNode plan, DryRunValidation validation, DryRunUsage usage, String skillKey,
                               Integer skillVersion, String stage, String endpointId, String model, String finishReason, String rawExcerpt) {}
    public record DraftRequest(String clientRequestId, String executionId, String note, Long maxCost,
                               com.aistareco.aep.enterprise.dto.EnterpriseBillingDtos.BillingSelection billing) {}
}
