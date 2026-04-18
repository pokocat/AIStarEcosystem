package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * Paginated response aligned with frontend {@code PaginatedResponse<T>}
 * ({@code apps/web_new/src/types/_shared.ts}).
 * <p>
 * Wire format:
 * <pre>{@code
 * {
 *   "success": true,
 *   "data": [...],
 *   "pagination": { "page": 0, "limit": 20, "total": 100, "totalPages": 5, "hasNext": true, "hasPrev": false }
 * }
 * }</pre>
 * Controllers return {@code PageEnvelope<T>} directly — do NOT wrap in {@code ApiResponse}.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PageEnvelope<T>(
        boolean success,
        List<T> data,
        PaginationMeta pagination,
        String message
) {
    public record PaginationMeta(
            int page,
            int limit,
            long total,
            int totalPages,
            boolean hasNext,
            boolean hasPrev
    ) {}

    public static <T> PageEnvelope<T> from(Page<T> page) {
        return new PageEnvelope<>(
                true,
                page.getContent(),
                new PaginationMeta(
                        page.getNumber(),
                        page.getSize(),
                        page.getTotalElements(),
                        page.getTotalPages(),
                        page.hasNext(),
                        page.hasPrevious()
                ),
                null
        );
    }
}
