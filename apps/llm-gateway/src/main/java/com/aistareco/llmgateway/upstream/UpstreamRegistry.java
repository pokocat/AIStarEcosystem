package com.aistareco.llmgateway.upstream;

import com.aistareco.llmgateway.config.GatewayProperties;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * upstream 注册表。当前仅从 application.yml 初始化（火山 + 千问）。
 *
 * TODO(admin-sync)：后续替换 refresh() 为定时调用 apps/server `/api/admin/ai-models`
 * 拉取启用项，按 priority 排序覆盖本表。注意 apiKey 解密只在 server 侧完成，
 * 网关只拿到明文 key；建议走内网 + mTLS。
 */
@Component
public class UpstreamRegistry {

    private static final Logger log = LoggerFactory.getLogger(UpstreamRegistry.class);

    private final GatewayProperties props;
    private final CopyOnWriteArrayList<Upstream> upstreams = new CopyOnWriteArrayList<>();

    public UpstreamRegistry(GatewayProperties props) {
        this.props = props;
    }

    @PostConstruct
    void init() {
        refreshFromYaml();
    }

    public List<Upstream> all() {
        return List.copyOf(upstreams);
    }

    public Optional<Upstream> findForModel(String model) {
        return upstreams.stream().filter(u -> u.matches(model)).findFirst();
    }

    /**
     * Phase B：由 AdminConfigSyncService 调用，替换当前 upstream 列表。
     * 任何来源（admin sync / 测试）都可以走这个入口。
     */
    public void replaceAll(List<Upstream> next) {
        if (next == null || next.isEmpty()) {
            log.warn("UpstreamRegistry replaceAll 收到空列表，保留旧值");
            return;
        }
        upstreams.clear();
        upstreams.addAll(next);
        log.info("UpstreamRegistry refreshed → {} upstreams: {}", upstreams.size(),
                upstreams.stream().map(Upstream::id).toList());
    }

    private void refreshFromYaml() {
        upstreams.clear();
        for (GatewayProperties.Upstream u : props.getUpstreams()) {
            if (u.getApiKey() == null || u.getApiKey().isBlank()
                    || u.getApiKey().startsWith("REPLACE_")) {
                log.warn("upstream id={} apiKey 未配置，跳过", u.getId());
                continue;
            }
            upstreams.add(new Upstream(
                    u.getId(),
                    u.getProviderType(),
                    u.getBaseUrl(),
                    u.getApiKey(),
                    u.getModelPrefixes(),
                    u.isEnabled()
            ));
        }
        log.info("UpstreamRegistry loaded {} upstreams from yaml", upstreams.size());
    }
}
