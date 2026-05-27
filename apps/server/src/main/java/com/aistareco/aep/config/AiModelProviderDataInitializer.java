package com.aistareco.aep.config;

import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiModelProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * v0.5 §D8：seed 1 个**禁用态**的 dev placeholder provider。
 *
 * 避免 admin 首次进 ai-models 页是空的，运营可以照着模板替换 baseUrl / apiKey 即可。
 * apiKey 用 AepCryptoUtil 加密落库（dev 用 fallback 密钥）。
 * Idempotent：已有数据时跳过。
 */
@Component
@Order(3)
@ConditionalOnProperty(name = "aep.seed.dev-data.enabled", havingValue = "true", matchIfMissing = true)
public class AiModelProviderDataInitializer implements CommandLineRunner {

    private final AiModelProviderRepository repo;

    public AiModelProviderDataInitializer(AiModelProviderRepository repo) {
        this.repo = repo;
    }

    @Override
    public void run(String... args) {
        if (repo.count() > 0) return;
        List<String> purposes = new ArrayList<>(List.of(
                AiModelPurpose.SCRIPT_DRAFT.name(),
                AiModelPurpose.TEMPLATE_REWRITE.name(),
                AiModelPurpose.GENERAL.name()
        ));

        AiModelProvider gatewayPlaceholder = AiModelProvider.builder()
                .id("ai-dev-placeholder")
                .name("DEV / llm-gateway 占位")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("http://127.0.0.1:8081/v1")
                .apiKeyEncrypted(AepCryptoUtil.encrypt("sk-dev-placeholder-replace-me"))
                .defaultModel("doubao-1-5-pro-32k")
                .purposes(purposes)
                .priority(50)
                .enabled(false)
                .build();
        repo.save(gatewayPlaceholder);

        // 火山方舟（Ark）—— OpenAI 兼容；defaultModel 填 endpoint id 或 Doubao 公共模型名
        // 官方文档：https://www.volcengine.com/docs/82379/1099475
        AiModelProvider volcengine = AiModelProvider.builder()
                .id("ai-volcengine-placeholder")
                .name("火山方舟 / Doubao 占位")
                .providerType(AiModelProviderType.VOLCENGINE)
                .baseUrl("https://ark.cn-beijing.volces.com/api/v3")
                .apiKeyEncrypted(AepCryptoUtil.encrypt("REPLACE_WITH_ARK_API_KEY"))
                .defaultModel("doubao-1-5-pro-32k")
                .purposes(new ArrayList<>(purposes))
                .priority(100)
                .enabled(false)
                .build();
        repo.save(volcengine);

        // 阿里云百炼 DashScope —— OpenAI 兼容模式
        // 官方文档：https://help.aliyun.com/zh/model-studio/developer-reference/compatibility-of-openai-with-dashscope
        AiModelProvider qwen = AiModelProvider.builder()
                .id("ai-qwen-placeholder")
                .name("阿里千问 / DashScope 占位")
                .providerType(AiModelProviderType.ALIYUN)
                .baseUrl("https://dashscope.aliyuncs.com/compatible-mode/v1")
                .apiKeyEncrypted(AepCryptoUtil.encrypt("REPLACE_WITH_DASHSCOPE_API_KEY"))
                .defaultModel("qwen-plus")
                .purposes(new ArrayList<>(purposes))
                .priority(110)
                .enabled(false)
                .build();
        repo.save(qwen);
    }
}
