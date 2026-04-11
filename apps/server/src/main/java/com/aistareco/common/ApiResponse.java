package com.aistareco.common;

/**
 * Wraps every successful response as {"data": ...} to match the frontend fetcher contract.
 */
public record ApiResponse<T>(T data) {
    public static <T> ApiResponse<T> of(T data) {
        return new ApiResponse<>(data);
    }
}
