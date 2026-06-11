package com.aistareco.aep.dto;

import java.util.List;

/** 带货授权审批决定（= TS StarCooperationDecision）。 */
public record StarCooperationDecisionDto(
        List<String> scenes,
        Integer expireMonths,
        Integer availableStyles,
        String reason
) {
}
