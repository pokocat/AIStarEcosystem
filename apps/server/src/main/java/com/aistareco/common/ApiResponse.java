package com.aistareco.common;

/**
 * Wraps every successful response as {"success": true, "data": ...}
 * to match the frontend {@code ApiResponse<T>} contract
 * (apps/web_new/src/types/_shared.ts).
 */
public record ApiResponse<T>(boolean success, T data, String message) {
    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(true, data, null);
    }

    public static <T> ApiResponse<T> of(T data, String message) {
        return new ApiResponse<>(true, data, message);
    }
}
