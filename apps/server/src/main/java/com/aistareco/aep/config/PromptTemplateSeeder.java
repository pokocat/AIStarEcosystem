package com.aistareco.aep.config;

import com.aistareco.aep.model.PlatformConfig;
import com.aistareco.aep.repository.PlatformConfigRepository;
import com.aistareco.aep.service.PromptService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

/**
 * Prompt 模板默认值 seeder（MATERIAL_OPS_AI_TEXT_PLAN §6.4）。
 *
 * 策略：
 *  - 每次启动：对每个已知 key「缺行才插」（resources/prompts/material/&lt;key&gt;.md）—— 不覆盖已存在的行。
 *  - 推新基线：bump SEED_VERSION 后，仅刷新运营未改过的行（version==1）；改过的行（version&gt;1）不动。
 *
 * 与 CelebrityProductSeeder 的「版本不匹配就 reset 清表」不同 —— prompt 是运营资产，
 * 绝不能因升级而 clobber 运营在后台改过的 prompt。
 */
@Component
@Order(38)
public class PromptTemplateSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(PromptTemplateSeeder.class);

    /** 推新默认 prompt 基线时改这个值；下次启动会刷新 version==1 的行。 */
    private static final String SEED_VERSION = "v5-2026-05-29-video-ref-analysis";
    private static final String CONFIG_KEY = "aep.material.prompt-seed-version";

    private final PromptService promptService;
    private final PlatformConfigRepository platformConfigRepo;

    public PromptTemplateSeeder(PromptService promptService,
                                PlatformConfigRepository platformConfigRepo) {
        this.promptService = promptService;
        this.platformConfigRepo = platformConfigRepo;
    }

    @Override
    public void run(String... args) {
        try {
            int inserted = 0;
            for (String key : PromptService.KNOWN_KEYS) {
                if (promptService.seedIfAbsent(key)) inserted++;
            }
            if (inserted > 0) log.info("PromptTemplateSeeder: +{} prompt 模板默认值入库", inserted);

            var existing = platformConfigRepo.findByConfigKey(CONFIG_KEY);
            String current = existing.map(PlatformConfig::getValueJson).orElse(null);
            if (!SEED_VERSION.equals(current)) {
                int refreshed = 0;
                for (String key : PromptService.KNOWN_KEYS) {
                    if (promptService.reseedBaselineIfUntouched(key)) refreshed++;
                }
                if (refreshed > 0) {
                    log.info("PromptTemplateSeeder: 刷新 {} 个未改动的 prompt 基线 → {}", refreshed, SEED_VERSION);
                }
                upsertSeedVersion(existing.orElse(null));
            }
        } catch (Exception e) {
            log.error("PromptTemplateSeeder failed: {}", e.getMessage(), e);
        }
    }

    private void upsertSeedVersion(PlatformConfig existing) {
        PlatformConfig cfg = existing != null
                ? existing
                : PlatformConfig.builder()
                        .id(UUID.randomUUID().toString())
                        .configKey(CONFIG_KEY)
                        .description("PromptTemplateSeeder 已种植的 prompt 基线版本号；不匹配时刷新 version==1 的行")
                        .version(0)
                        .build();
        cfg.setValueJson(SEED_VERSION);
        cfg.setVersion(cfg.getVersion() + 1);
        cfg.setUpdatedAt(Instant.now());
        cfg.setUpdatedBy("system:PromptTemplateSeeder");
        platformConfigRepo.save(cfg);
    }
}
