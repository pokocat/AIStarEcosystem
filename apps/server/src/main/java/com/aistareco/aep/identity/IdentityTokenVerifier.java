package com.aistareco.aep.identity;

import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;

/**
 * 账号中心 RS256 令牌验签（{@code docs/unified-identity-plan.md} §12.1）。
 *
 * <p>验：签名（JWKS 远端公钥，Nimbus 自带缓存 + kid 未命中时刷新）、{@code iss}、{@code exp}、
 * {@code aud} 含本产品 audience。
 *
 * <p>JWKS 地址优先取显式配置 {@code aep.identity.jwks-uri}；未配置则**惰性**（首次用到时，
 * 不在启动期）经 {@code <issuer>/.well-known/openid-configuration} 发现，结果与 decoder 一起
 * 进程内缓存。发现失败不缓存失败态，下次请求会重试。
 *
 * <p>§8.0：issuer 未配置时 {@link #isEnabled()} 为 false，{@link #verify} 直接抛
 * {@link JwtException} —— 调用方据此让 RS256 令牌落 401，绝不放行。
 */
@Component
public class IdentityTokenVerifier {

    private static final Logger log = LoggerFactory.getLogger(IdentityTokenVerifier.class);

    private final IdentityProperties props;
    private final RestClient discoveryClient;

    private volatile NimbusJwtDecoder decoder;

    public IdentityTokenVerifier(IdentityProperties props) {
        this.props = props;
        this.discoveryClient = RestClient.create();
    }

    public boolean isEnabled() {
        return props.isEnabled();
    }

    /** 校验并解析账号中心令牌；任何不合法（签名 / iss / exp / aud）都抛 {@link JwtException}。 */
    public Jwt verify(String token) {
        if (!props.isEnabled()) {
            throw new BadJwtException("aep.identity.issuer 未配置，拒绝账号中心令牌");
        }
        return decoder().decode(token);
    }

    private NimbusJwtDecoder decoder() {
        NimbusJwtDecoder cached = this.decoder;
        if (cached != null) return cached;
        synchronized (this) {
            if (this.decoder != null) return this.decoder;
            String jwksUri = resolveJwksUri();
            NimbusJwtDecoder built = NimbusJwtDecoder.withJwkSetUri(jwksUri)
                    .jwsAlgorithm(SignatureAlgorithm.RS256)
                    .build();
            OAuth2TokenValidator<Jwt> standard = JwtValidators.createDefaultWithIssuer(props.baseUrl());
            built.setJwtValidator(jwt -> {
                OAuth2TokenValidatorResult base = standard.validate(jwt);
                if (base.hasErrors()) return base;
                List<String> aud = jwt.getAudience();
                if (aud == null || !aud.contains(props.getAudience())) {
                    return OAuth2TokenValidatorResult.failure(new OAuth2Error(
                            "invalid_token",
                            "令牌 aud 不含本产品 audience " + props.getAudience(),
                            null));
                }
                return OAuth2TokenValidatorResult.success();
            });
            log.info("[identity] JWKS decoder ready issuer={} jwksUri={} audience={}",
                    props.baseUrl(), jwksUri, props.getAudience());
            this.decoder = built;
            return built;
        }
    }

    private String resolveJwksUri() {
        String explicit = props.getJwksUri();
        if (explicit != null && !explicit.isBlank()) return explicit.trim();
        String discoveryUrl = props.baseUrl() + "/.well-known/openid-configuration";
        try {
            JsonNode doc = discoveryClient.get().uri(discoveryUrl).retrieve().body(JsonNode.class);
            String uri = doc == null ? null : doc.path("jwks_uri").asText(null);
            if (uri == null || uri.isBlank()) {
                throw new BadJwtException("账号中心发现文档缺少 jwks_uri: " + discoveryUrl);
            }
            return uri;
        } catch (JwtException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new BadJwtException("无法读取账号中心发现文档 " + discoveryUrl + ": " + e.getMessage());
        }
    }

    /** 测试 / 运维用：丢弃缓存的 decoder（JWKS 地址变更后重新发现）。 */
    public void reset() {
        this.decoder = null;
    }
}
