package com.aistareco.aep.config;

import com.aistareco.aep.model.AiModelProvider;
import com.aistareco.aep.model.AiModelPurpose;
import com.aistareco.aep.model.AiModelProviderType;
import com.aistareco.aep.repository.AiModelProviderRepository;
import com.aistareco.common.AepCryptoUtil;
import org.springframework.boot.CommandLineRunner;
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
        AiModelProvider placeholder = AiModelProvider.builder()
                .id("ai-dev-placeholder")
                .name("DEV / OpenAI 占位")
                .providerType(AiModelProviderType.OPENAI_COMPATIBLE)
                .baseUrl("http://127.0.0.1:8081/v1")
                .apiKeyEncrypted(AepCryptoUtil.encrypt("sk-dev-placeholder-replace-me"))
                .defaultModel("gpt-4o")
                .purposes(purposes)
                .priority(100)
                .enabled(false)
                .build();
        repo.save(placeholder);
    }
}
