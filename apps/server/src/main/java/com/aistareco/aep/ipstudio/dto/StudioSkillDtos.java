package com.aistareco.aep.ipstudio.dto;

import java.util.List;
import java.util.Map;

/** Wire mirror of StudioSkillSummary / StudioSkillLimits in packages/types/src/ip-studio-workflow.ts (field names 1:1). */
public final class StudioSkillDtos {
    private StudioSkillDtos() {}
    /** {@code maxSegmentSec} is a positive integer or the string {@code "model"} (read from the selected video model contract). */
    public record SkillLimits(int maxSourceSec, int maxSegments, Object maxSegmentSec, int maxSteps, int maxAutoFixPerSegment) {}
    public record SkillSummary(String key, String name, int version, String status, String planning, String summary,
                               List<String> methodExamples, Map<String, List<String>> operations, SkillLimits limits,
                               List<String> checks, List<String> autoFixChecks, List<String> requiredCapabilities) {}
}
