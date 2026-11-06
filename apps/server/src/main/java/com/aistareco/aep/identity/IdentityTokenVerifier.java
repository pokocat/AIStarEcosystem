package com.aistareco.aep.identity;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.RemoteKeySourceException;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * 账号中心 RS256 令牌验签（{@code docs/unified-identity-plan.md} §12.1）。
 *
 * <p>验：签名（公钥来自 {@link IdentityJwkCache}）、{@code iss}、{@code exp}、{@code aud} 含本产品 audience。
 * 验签全程不碰网络，账号中心断开不影响已登录用户；公钥怎么取、断开时怎么办见 {@link IdentityJwkCache}。
 *
 * <p>§8.0：issuer 未配置时 {@link #isEnabled()} 为 false，{@link #verify} 直接抛
 * {@link JwtException} —— 调用方据此让 RS256 令牌落 401，绝不放行。
 */
@Component
public class IdentityTokenVerifier {

    private final IdentityProperties props;
    private final IdentityJwkCache keys;

    private volatile NimbusJwtDecoder decoder;

    public IdentityTokenVerifier(IdentityProperties props, IdentityJwkCache keys) {
        this.props = props;
        this.keys = keys;
    }

    public boolean isEnabled() {
        return props.isEnabled();
    }

    /**
     * 校验并解析账号中心令牌；任何不合法（签名 / iss / exp / aud）都抛 {@link JwtException}。
     *
     * @throws IdentityKeysUnavailableException 没有公钥可以判断这个令牌（不等于令牌无效）
     */
    public Jwt verify(String token) {
        if (!props.isEnabled()) {
            throw new BadJwtException("aep.identity.issuer 未配置，拒绝账号中心令牌");
        }
        try {
            return decoder().decode(token);
        } catch (JwtException e) {
            if (e.getCause() instanceof RemoteKeySourceException unavailable) {
                throw new IdentityKeysUnavailableException(unavailable.getMessage(), unavailable);
            }
            throw e;
        }
    }

    /** 构建不碰网络，也不需要锁：并发时多建一个也一样。 */
    private NimbusJwtDecoder decoder() {
        NimbusJwtDecoder cached = this.decoder;
        if (cached != null) return cached;
        DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
        processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, keys));
        // 声明由下面的 Spring 校验器统一判断，Nimbus 这边不重复判断（与 NimbusJwtDecoder 自带的 builder 相同）。
        processor.setJWTClaimsSetVerifier((claims, context) -> { });
        NimbusJwtDecoder built = new NimbusJwtDecoder(processor);
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
        this.decoder = built;
        return built;
    }
}
