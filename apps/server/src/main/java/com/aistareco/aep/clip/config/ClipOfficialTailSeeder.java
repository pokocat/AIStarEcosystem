package com.aistareco.aep.clip.config;

import com.aistareco.aep.clip.service.ClipAssetService;
import com.aistareco.aep.clip.service.ClipTemplateService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** 给内置模板准备可播放、可替换的竖屏固定视频；运营配置过 tailClips 后不覆盖。 */
@Component
@Order(90)
public class ClipOfficialTailSeeder implements ApplicationRunner {
    private final ClipAssetService assets;
    private final ClipTemplateService templates;
    private final boolean enabled;

    public ClipOfficialTailSeeder(ClipAssetService assets, ClipTemplateService templates,
                                  @Value("${aep.clip.seed-official-templates:true}") boolean enabled) { this.assets = assets; this.templates = templates; this.enabled = enabled; }

    @Override public void run(ApplicationArguments args) throws Exception {
        if (!enabled) return;
        seed("ct_shiti", "ca_tail_story", "故事收束", "clip/tails/story.mp4");
        seed("ct_kaimen", "ca_tail_open", "门店信息收束", "clip/tails/open.mp4");
        seed("ct_shouyi", "ca_tail_craft", "手艺人收束", "clip/tails/craft.mp4");
    }

    private void seed(String templateId, String assetId, String label, String resource) throws Exception {
        byte[] bytes;
        try (var input = new ClassPathResource(resource).getInputStream()) { bytes = input.readAllBytes(); }
        var asset = assets.ensureBundledPreset(assetId, label, "tail", bytes);
        templates.attachTailClipIfMissing(templateId, asset);
    }
}
