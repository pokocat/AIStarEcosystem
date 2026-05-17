package com.aistareco.llmgateway.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * 网关配置。当前 upstreams 从 application.yml 读；
 * TODO(admin-sync)：后续替换为定时拉 apps/server `/api/admin/ai-models` 的实现，
 * 见 UpstreamRegistry 中的 refresh() 注释。
 */
@ConfigurationProperties(prefix = "llm-gateway")
public class GatewayProperties {

    private List<Upstream> upstreams = new ArrayList<>();
    private AdminSync adminSync = new AdminSync();
    private BusinessAuth businessAuth = new BusinessAuth();

    public List<Upstream> getUpstreams() { return upstreams; }
    public void setUpstreams(List<Upstream> upstreams) { this.upstreams = upstreams; }
    public AdminSync getAdminSync() { return adminSync; }
    public void setAdminSync(AdminSync adminSync) { this.adminSync = adminSync; }
    public BusinessAuth getBusinessAuth() { return businessAuth; }
    public void setBusinessAuth(BusinessAuth businessAuth) { this.businessAuth = businessAuth; }

    public static class AdminSync {
        private boolean enabled = false;
        /** apps/server base url，含 scheme + port */
        private String serverBaseUrl = "http://127.0.0.1:8080";
        /** 与 apps/server `aep.internal.secret` 一致 */
        private String secret = "";
        /** 轮询周期（秒） */
        private int pollSeconds = 30;

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public String getServerBaseUrl() { return serverBaseUrl; }
        public void setServerBaseUrl(String serverBaseUrl) { this.serverBaseUrl = serverBaseUrl; }
        public String getSecret() { return secret; }
        public void setSecret(String secret) { this.secret = secret; }
        public int getPollSeconds() { return pollSeconds; }
        public void setPollSeconds(int pollSeconds) { this.pollSeconds = pollSeconds; }
    }

    public static class BusinessAuth {
        /** 是否要求 Authorization: Bearer sk-aep-* 鉴权（false 时任何 key 都放行） */
        private boolean enabled = false;
        /** 本地缓存 TTL（秒） */
        private int cacheTtlSeconds = 60;

        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
        public int getCacheTtlSeconds() { return cacheTtlSeconds; }
        public void setCacheTtlSeconds(int cacheTtlSeconds) { this.cacheTtlSeconds = cacheTtlSeconds; }
    }

    public static class Upstream {
        /** 内部 id，日志用 */
        private String id;
        /** providerType，对应 apps/server AiModelProviderType.wire()（VOLCENGINE / ALIYUN / OPENAI_COMPATIBLE …） */
        private String providerType;
        /** 上游 base url，需以 /v1 结尾（chat/completions 会拼接在后面） */
        private String baseUrl;
        /** 上游 api key 明文（生产从环境变量注入） */
        private String apiKey;
        /** model 前缀路由 ——「doubao-」「qwen-」等；命中即走该 upstream */
        private List<String> modelPrefixes = new ArrayList<>();
        /** 是否启用 */
        private boolean enabled = true;

        public String getId() { return id; }
        public void setId(String id) { this.id = id; }
        public String getProviderType() { return providerType; }
        public void setProviderType(String providerType) { this.providerType = providerType; }
        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public List<String> getModelPrefixes() { return modelPrefixes; }
        public void setModelPrefixes(List<String> modelPrefixes) { this.modelPrefixes = modelPrefixes; }
        public boolean isEnabled() { return enabled; }
        public void setEnabled(boolean enabled) { this.enabled = enabled; }
    }
}
