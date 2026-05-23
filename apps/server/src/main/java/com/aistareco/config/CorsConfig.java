package com.aistareco.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

import java.util.Arrays;
import java.util.List;

@Configuration
public class CorsConfig {

    private final String allowedOriginPatterns;

    public CorsConfig(@Value("${aep.cors.allowed-origin-patterns:http://localhost:*,http://127.0.0.1:*}") String allowedOriginPatterns) {
        this.allowedOriginPatterns = allowedOriginPatterns;
    }

    @Bean
    public CorsFilter corsFilter() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(parseAllowedOrigins());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return new CorsFilter(source);
    }

    private List<String> parseAllowedOrigins() {
        return Arrays.stream(allowedOriginPatterns.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .toList();
    }
}
