package com.aistareco.aep.config;

import com.aistareco.aep.service.ai.PublicModelErrorPolicy;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.converter.json.AbstractJackson2HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/** Wire-only protection covers historical job/Director errors without rewriting customer data or operator evidence. */
@RestControllerAdvice
public final class PublicModelErrorAdvice implements ResponseBodyAdvice<Object> {
    private final ObjectMapper mapper;
    public PublicModelErrorAdvice(ObjectMapper mapper) { this.mapper = mapper; }
    @Override public boolean supports(MethodParameter method, Class<? extends HttpMessageConverter<?>> converter) {
        return AbstractJackson2HttpMessageConverter.class.isAssignableFrom(converter);
    }
    @Override public Object beforeBodyWrite(Object body, MethodParameter method, MediaType mediaType,
            Class<? extends HttpMessageConverter<?>> converter, ServerHttpRequest request, ServerHttpResponse response) {
        if (body == null || request.getURI().getPath().startsWith("/api/admin/")) return body;
        return PublicModelErrorPolicy.response(mapper.valueToTree(body));
    }
}
