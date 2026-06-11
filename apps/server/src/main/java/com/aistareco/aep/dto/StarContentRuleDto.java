package com.aistareco.aep.dto;

import com.aistareco.aep.model.StarContentRule;

/** 内容规则 DTO（= TS StarContentRule）。 */
public record StarContentRuleDto(
        String id,
        String name,
        StarContentRule.Zone zone,
        boolean enabled,
        String description
) {
    public static StarContentRuleDto from(StarContentRule r) {
        return new StarContentRuleDto(r.getId(), r.getName(), r.getZone(), r.isEnabled(), r.getDescription());
    }
}
