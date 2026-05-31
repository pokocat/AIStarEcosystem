package com.aistareco.aep.aiavatar.config;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarTemplate;
import com.aistareco.aep.aiavatar.model.AiAvatarTemplateCategory;
import com.aistareco.aep.aiavatar.repository.AiAvatarTemplateRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * AiAvatar 工厂模板种子（AI 模板中心初始数据）。幂等：表非空则跳过。
 * 不受 aep.seed.dev-data 开关控制 —— 工厂模板是平台基础数据，生产也需要（沿用 MixcutPresetSeeder 惯例）。
 */
@Component
@Order(60)
public class AiAvatarTemplateSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(AiAvatarTemplateSeeder.class);

    private final AiAvatarTemplateRepository repo;

    public AiAvatarTemplateSeeder(AiAvatarTemplateRepository repo) {
        this.repo = repo;
    }

    @Override
    public void run(String... args) {
        if (repo.countByOfficialTrue() > 0) {
            return;
        }
        List<AiAvatarTemplate> seeds = List.of(
                tpl("自然美颜", AiAvatarTemplateCategory.BEAUTY, AiAvatarCapability.RESTORE,
                        "GFPGAN 高清修复 + 轻磨皮 + 自然提亮，保留五官辨识度",
                        "{\"beautyStrength\":0.55,\"smoothing\":0.4,\"brighten\":0.2,\"engine\":\"GFPGAN\"}"),
                tpl("影棚质感", AiAvatarTemplateCategory.RETOUCH, AiAvatarCapability.RESTORE,
                        "影棚级肤质 + 冷调高光 + 边缘锐化",
                        "{\"beautyStrength\":0.45,\"colorGrade\":\"studio_cool\",\"sharpen\":0.3}"),
                tpl("未来机能风", AiAvatarTemplateCategory.STYLE, AiAvatarCapability.IMG2IMG,
                        "冷感光泽、机能材质、舞台反光的整体风格化",
                        "{\"style\":\"future_mecha\",\"strength\":0.6}"),
                tpl("国风古典", AiAvatarTemplateCategory.STYLE, AiAvatarCapability.IMG2IMG,
                        "东方古典审美：水墨意境、温润光感",
                        "{\"style\":\"guofeng\",\"strength\":0.6}"),
                tpl("精致日常妆", AiAvatarTemplateCategory.BEAUTY, AiAvatarCapability.MAKEUP,
                        "自然底妆 + 柔焦眼妆 + 水光唇，妆容迁移保留五官",
                        "{\"makeupRef\":\"daily_soft\",\"intensity\":0.5,\"engine\":\"EleGANt\"}"),
                tpl("标准四视图", AiAvatarTemplateCategory.COMPOSITION, AiAvatarCapability.RESTORE,
                        "正面半身 / 正面全身 / 左侧脸 / 右侧脸 标准构图出图",
                        "{\"composition\":\"standard_4\",\"withExpression\":true}")
        );
        repo.saveAll(seeds);
        log.info("[aiavatar-seed] seeded {} factory templates", seeds.size());
    }

    private AiAvatarTemplate tpl(String name, AiAvatarTemplateCategory cat, AiAvatarCapability cap, String desc, String params) {
        return AiAvatarTemplate.builder()
                .id("dhtpl-" + name.hashCode())
                .name(name)
                .category(cat)
                .capability(cap)
                .description(desc)
                .paramsJson(params)
                .official(true)
                .enabled(true)
                .usageCount(0)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
    }
}
