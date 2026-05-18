package com.aistareco.aep.config;

import com.aistareco.aep.dto.MixcutTemplateUpsertRequest;
import com.aistareco.aep.service.mixcut.MixcutTemplateService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.util.List;

/**
 * 启动时如果 mixcut_template 表为空（无 factory 模板），尝试从
 * {@code classpath:seed/mixcut-templates.json} 读取并 seed。
 *
 * 该 JSON 文件结构 = MixcutTemplateUpsertRequest[]（每条带完整 canvas/scenes/quality_gate/metadata）。
 *
 * 当前版本（v0.12 初版）seed 文件可缺省 —— 缺省时 server 端 factory 模板为空，
 * 前端 listTemplates() 在 REAL_BACKEND 模式下需要做合并：
 *   server 返回 + 前端 mockTemplates fallback（按 template_id 去重）。
 *
 * 等 seed JSON 就绪后（从前端 mocks 一次性导出），即可移除前端 mock fallback。
 */
@Component
@Order(20)
public class MixcutTemplateSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MixcutTemplateSeeder.class);
    private static final String SEED_RESOURCE = "seed/mixcut-templates.json";

    private final MixcutTemplateService service;
    private final ObjectMapper mapper;

    public MixcutTemplateSeeder(MixcutTemplateService service, ObjectMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @Override
    public void run(String... args) {
        if (service.hasAnyFactory()) {
            log.debug("MixcutTemplate seed: factory rows already present, skip.");
            return;
        }
        var res = new ClassPathResource(SEED_RESOURCE);
        if (!res.exists()) {
            log.info("MixcutTemplate seed: no {} on classpath, skip (factory templates will be served from frontend mocks).", SEED_RESOURCE);
            return;
        }
        try (InputStream in = res.getInputStream()) {
            List<MixcutTemplateUpsertRequest> list = mapper.readValue(
                    in, new TypeReference<List<MixcutTemplateUpsertRequest>>() {}
            );
            int n = 0;
            for (var req : list) {
                try {
                    service.upsertFactory(req);
                    n++;
                } catch (Exception e) {
                    log.warn("MixcutTemplate seed: failed to seed template_id={}: {}",
                            req.templateId(), e.getMessage());
                }
            }
            log.info("MixcutTemplate seed: seeded {} factory templates from {}.", n, SEED_RESOURCE);
        } catch (Exception e) {
            log.warn("MixcutTemplate seed: failed to parse {}: {}", SEED_RESOURCE, e.getMessage());
        }
    }
}
