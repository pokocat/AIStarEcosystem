package com.aistareco.aep.dto;

import com.aistareco.aep.model.ForgeTemplate;

import java.util.List;

public record ForgeTemplateDto(
        String id,
        String name,
        String image,
        List<String> tags,
        String style
) {
    public static ForgeTemplateDto from(ForgeTemplate t) {
        return new ForgeTemplateDto(
                t.getId(), t.getName(), t.getImage(),
                t.getTags(), t.getStyle()
        );
    }
}
