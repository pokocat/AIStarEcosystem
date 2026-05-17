package com.aistareco.llmgateway.service;

import com.aistareco.llmgateway.config.GatewayProperties;
import com.aistareco.llmgateway.upstream.Upstream;
import com.aistareco.llmgateway.upstream.UpstreamRegistry;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * 周期性从 apps/server 拉 enabled upstream 列表，覆盖 UpstreamRegistry。
 * llm-gateway.admin-sync.enabled=false 时本服务不启动 polling，
 * Registry 继续吃 application.yml 静态配置。
 */
@Service
public class AdminConfigSyncService {

    private static final Logger log = LoggerFactory.getLogger(AdminConfigSyncService.class);

    private final GatewayProperties props;
    private final UpstreamRegistry registry;
    private final ObjectMapper om = new ObjectMapper();
    private final WebClient client;

    public AdminConfigSyncService(GatewayProperties props, UpstreamRegistry registry,
                                   WebClient.Builder builder) {
        this.props = props;
        this.registry = registry;
        this.client = builder.baseUrl(props.getAdminSync().getServerBaseUrl()).build();
    }

    @PostConstruct
    void initialPull() {
        if (!props.getAdminSync().isEnabled()) {
            log.info("admin-sync 未启用，跳过首次拉取");
            return;
        }
        try {
            pullOnce();
        } catch (Exception e) {
            log.warn("admin-sync 首次拉取失败，沿用 yaml 静态配置: {}", e.getMessage());
        }
    }

    @Scheduled(fixedDelayString = "#{${llm-gateway.admin-sync.poll-seconds:30} * 1000}")
    public void poll() {
        if (!props.getAdminSync().isEnabled()) return;
        try {
            pullOnce();
        } catch (Exception e) {
            log.warn("admin-sync 拉取失败: {}", e.getMessage());
        }
    }

    private void pullOnce() {
        String body = client.get()
                .uri("/api/internal/ai-models/upstreams")
                .header("X-Internal-Secret", props.getAdminSync().getSecret())
                .retrieve()
                .bodyToMono(String.class)
                .block(Duration.ofSeconds(10));
        if (body == null) {
            log.warn("admin-sync 返回空 body");
            return;
        }
        try {
            JsonNode root = om.readTree(body);
            JsonNode data = root.path("data");
            if (!data.isArray()) {
                log.warn("admin-sync 响应缺少 data 数组：{}", body);
                return;
            }
            List<Upstream> next = new ArrayList<>();
            for (Iterator<JsonNode> it = data.elements(); it.hasNext(); ) {
                JsonNode n = it.next();
                String apiKey = n.path("apiKey").asText("");
                if (apiKey.isBlank()) {
                    log.warn("upstream {} apiKey 为空，跳过", n.path("id").asText());
                    continue;
                }
                List<String> prefixes = new ArrayList<>();
                for (JsonNode p : n.path("modelPrefixes")) prefixes.add(p.asText());
                next.add(new Upstream(
                        n.path("id").asText(),
                        n.path("providerType").asText(),
                        n.path("baseUrl").asText(),
                        apiKey,
                        prefixes,
                        n.path("enabled").asBoolean(true)
                ));
            }
            registry.replaceAll(next);
        } catch (Exception e) {
            log.warn("admin-sync 解析失败: {}", e.getMessage());
        }
    }
}
