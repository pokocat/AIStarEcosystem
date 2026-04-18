package com.aistareco.aep.dto;

import java.util.List;

public record ForgeOptionsDto(
        List<ForgeTemplateDto> templates,
        List<LabeledOptionDto> styles,
        List<LabeledOptionDto> moods,
        List<FaceSliderDto> faceSliders,
        List<ColorSchemeDto> colorSchemes
) {}
