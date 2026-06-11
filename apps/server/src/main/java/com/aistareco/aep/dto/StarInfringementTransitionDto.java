package com.aistareco.aep.dto;

/** 侵权案例处置请求体：action ∈ investigate / confirm / resolve / dismiss。 */
public record StarInfringementTransitionDto(String action, String note) {
}
