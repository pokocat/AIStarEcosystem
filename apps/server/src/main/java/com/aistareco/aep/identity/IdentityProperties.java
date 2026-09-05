package com.aistareco.aep.identity;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * {@code aep.identity.*} —— 统一账号中心（id.aibuzz.cn）接入配置。
 *
 * <p>真源：{@code docs/unified-identity-plan.md} §12.1 / §12.4。
 *
 * <p><b>§8.0 合规</b>：{@link #issuer} 留空 = 本能力整体关闭（RS256 令牌一律 401，
 * outbox poller 不跑，admin 导入端点 503）。**不存在**「未配置就伪造身份 / 本地签发
 * 假 uid」的降级路径 —— 关闭态下老的 HS256 登录链路完全不受影响。
 */
@Configuration
@ConfigurationProperties(prefix = "aep.identity")
public class IdentityProperties {

    /**
     * 账号中心 issuer（= 令牌 {@code iss} claim，且用于发现 {@code jwks_uri} / 拼 API 地址）。
     * 空字符串 = 关闭账号中心接入。dev 默认 {@code http://localhost:8090}。
     */
    private String issuer = "";

    /**
     * JWKS 地址显式覆盖。留空时惰性走 {@code <issuer>/.well-known/openid-configuration}
     * 发现，发现结果进程内缓存。
     */
    private String jwksUri = "";

    /** 本产品的 audience；账号中心签发的 access token 的 {@code aud} 必须包含它。 */
    private String audience = "aistar-api";

    /** 机器互调（client_credentials）用的 client id。 */
    private String clientId = "aistar-server";

    /** 机器互调 client secret；留空 = 不做任何回报 / 不拉 outbox / 不能导入。 */
    private String clientSecret = "";

    /** outbox 轮询间隔（秒）。 */
    private int outboxPollSeconds = 30;

    /** 本产品在账号中心的 product code（URL 路径段）。 */
    private String productCode = "aistar";

    public String getIssuer() { return issuer; }
    public void setIssuer(String issuer) { this.issuer = issuer; }

    public String getJwksUri() { return jwksUri; }
    public void setJwksUri(String jwksUri) { this.jwksUri = jwksUri; }

    public String getAudience() { return audience; }
    public void setAudience(String audience) { this.audience = audience; }

    public String getClientId() { return clientId; }
    public void setClientId(String clientId) { this.clientId = clientId; }

    public String getClientSecret() { return clientSecret; }
    public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }

    public int getOutboxPollSeconds() { return outboxPollSeconds; }
    public void setOutboxPollSeconds(int outboxPollSeconds) { this.outboxPollSeconds = outboxPollSeconds; }

    public String getProductCode() { return productCode; }
    public void setProductCode(String productCode) { this.productCode = productCode; }

    /** 账号中心接入是否开启（issuer 已配置）。 */
    public boolean isEnabled() {
        return issuer != null && !issuer.isBlank();
    }

    /** 机器互调是否可用（issuer + clientSecret 都配了）。 */
    public boolean isMachineCallEnabled() {
        return isEnabled() && clientSecret != null && !clientSecret.isBlank();
    }

    /** issuer 去掉末尾斜杠，便于拼路径。 */
    public String baseUrl() {
        String value = issuer == null ? "" : issuer.trim();
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        return value;
    }
}
