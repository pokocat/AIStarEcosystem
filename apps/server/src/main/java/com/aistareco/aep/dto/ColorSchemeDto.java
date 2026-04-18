package com.aistareco.aep.dto;

import java.util.List;

public record ColorSchemeDto(
        String id,
        String name,
        List<String> colors
) {}
