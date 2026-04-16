package com.aistareco.aep.dto;

import org.springframework.data.domain.Page;

import java.util.List;

public record PageEnvelope<T>(
        List<T> content,
        long totalElements,
        int totalPages,
        int number,
        int size
) {
    public static <T> PageEnvelope<T> from(Page<T> page) {
        return new PageEnvelope<>(
                page.getContent(),
                page.getTotalElements(),
                page.getTotalPages(),
                page.getNumber(),
                page.getSize()
        );
    }
}
