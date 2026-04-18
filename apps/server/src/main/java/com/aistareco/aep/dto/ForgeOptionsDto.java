package com.aistareco.aep.dto;

import java.util.List;

/**
 * Wire-format for the appearance-forge options bundle.
 * 字段形状与前端 {@code types/appearance-forge.ts:ForgeOptions} 一一对齐：
 * hairStyles / eyeColors / styleTags 复用 {@link LabeledOptionDto}。
 */
public record ForgeOptionsDto(
        List<ForgeTemplateDto> templates,
        List<LabeledOptionDto> hairStyles,
        List<LabeledOptionDto> eyeColors,
        List<LabeledOptionDto> styleTags,
        List<FaceSliderDto> faceSliders,
        List<ColorSchemeDto> colorSchemes,
        List<String> promptSuggestions
) {}
