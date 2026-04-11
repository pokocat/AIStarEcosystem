package com.aistareco.common;

/**
 * Error payload nested inside {"error": {...}} response.
 */
public record ApiErrorBody(String code, String message) {}
