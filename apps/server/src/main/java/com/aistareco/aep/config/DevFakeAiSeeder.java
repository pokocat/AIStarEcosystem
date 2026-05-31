package com.aistareco.aep.config;

import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiModelEndpoint;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.repository.AiAppBindingRepository;
import com.aistareco.aep.repository.AiModelEndpointRepository;
import com.aistareco.common.AepCryptoUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * 开发 / 离线联调专用：把一个「本地 fake 大模型端点」一键接入，并为形象锻造 / 短剧脚本 /
 * 视频生成等用途绑定到它。
 *
 * 仅当 {@code aep.dev-fake-llm.enabled=true} 时运行。默认关闭；dev 连后端模式必须配置真实端点，
 * 不能自动注入 fake provider。
 * 幂等：端点 / 绑定已存在则不覆盖 —— 运营在后台配过真实端点后，本 seeder 不会抢路由。
 *
 * 配套的 fake 服务见仓库 {@code scripts/dev-fake-llm-server.mjs}（OpenAI 兼容 /chat/completions
 * + 视频异步 submit/poll）。把它跑在 {@code aep.dev-fake-llm.base-url} 指向的地址即可。
 */
@Component
@Order(56)
@ConditionalOnProperty(prefix = "aep.dev-fake-llm", name = "enabled", havingValue = "true")
public class DevFakeAiSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DevFakeAiSeeder.class);
    private static final String ENDPOINT_ID = "dev-fake-llm";

    /** 默认绑定到 fake 端点的用途（已被运营绑定过的不动）。 */
    private static final List<AiModelPurpose> SEED_PURPOSES = List.of(
            AiModelPurpose.APPEARANCE_FORGE,
            AiModelPurpose.DRAMA_SCRIPT_DRAFT,
            AiModelPurpose.SCRIPT_DRAFT,
            AiModelPurpose.SELLING_POINTS,
            AiModelPurpose.VARIABLE_EXTRACT,
            AiModelPurpose.VIDEO_GENERATION,
            AiModelPurpose.GENERAL
    );

    private final AiModelEndpointRepository endpointRepo;
    private final AiAppBindingRepository bindingRepo;
    private final String baseUrl;
    private final String model;

    public DevFakeAiSeeder(AiModelEndpointRepository endpointRepo,
                           AiAppBindingRepository bindingRepo,
                           @Value("${aep.dev-fake-llm.base-url:http://localhost:8091/v1}") String baseUrl,
                           @Value("${aep.dev-fake-llm.model:fake-model-v1}") String model) {
        this.endpointRepo = endpointRepo;
        this.bindingRepo = bindingRepo;
        this.baseUrl = baseUrl;
        this.model = model;
    }

    @Override
    public void run(String... args) {
        try {
            Instant now = Instant.now();
            if (!endpointRepo.existsById(ENDPOINT_ID)) {
                endpointRepo.save(AiModelEndpoint.builder()
                        .id(ENDPOINT_ID)
                        .name("本地联调模型（fake）")
                        .providerType(AiModelProviderType.OPENAI)
                        .baseUrl(baseUrl)
                        .upstreamApiKeyEncrypted(AepCryptoUtil.encrypt("dev-fake-key"))
                        .model(model)
                        .enabled(true)
                        .createdAt(now)
                        .updatedAt(now)
                        .build());
                log.warn("⚙️  DevFakeAiSeeder：已接入本地 fake 大模型端点 baseUrl={} model={}（仅联调用）", baseUrl, model);
            }
            int bound = 0;
            for (AiModelPurpose purpose : SEED_PURPOSES) {
                if (bindingRepo.findById(purpose).isEmpty()) {
                    bindingRepo.save(AiAppBinding.builder()
                            .purpose(purpose)
                            .endpointId(ENDPOINT_ID)
                            .updatedAt(now)
                            .build());
                    bound++;
                }
            }
            if (bound > 0) {
                log.warn("⚙️  DevFakeAiSeeder：已为 {} 个用途绑定到 fake 端点（形象锻造/短剧脚本/视频生成等）", bound);
            }
        } catch (Exception e) {
            log.error("DevFakeAiSeeder failed: {}", e.getMessage(), e);
        }
    }
}
