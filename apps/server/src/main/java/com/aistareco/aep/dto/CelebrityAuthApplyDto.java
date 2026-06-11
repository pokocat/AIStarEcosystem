package com.aistareco.aep.dto;

import java.util.List;

/** web-celebrity 创作者申请明星带货授权请求体（v0.60 打通）。 */
public record CelebrityAuthApplyDto(List<String> scenes, String note) {
}
