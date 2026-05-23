package com.aistareco.aep.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * 前端 POST /api/me/products/parse-link / /api/me/products/from-link 请求体。
 * 仅一个字段：url。
 */
public record ProductLinkParseRequest(
        @JsonProperty("url") String url
) {
}
