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
    private final boolean reseed;

    public ClipOfficialTailSeeder(ClipAssetService assets, ClipTemplateService templates,
                                  @Value("${aep.clip.seed-official-templates:true}") boolean enabled,
                                  @Value("${aep.clip.reseed-official-templates:false}") boolean reseed) { this.assets = assets; this.templates = templates; this.enabled = enabled; this.reseed = reseed; }

    @Override public void run(ApplicationArguments args) throws Exception {
        if (!enabled) return;
        // 2026-08-13 片尾换新：给新 assetId，否则 ensureBundledPreset 见同 id 直接返回旧素材。
        seed("ct_shiti", reseed ? "ca_tail_story_v2" : "ca_tail_story", "为实体发声片尾", "clip/tails/story.mp4");
        // ct_kaimen / ct_shouyi 的片尾已停种（2026-08-14）：产品侧只保留「为实体发声」一个模板
        // （端上 catalog.js 的 OFFERED_TEMPLATE_IDS 只有 ct_shiti），这两条片尾没有任何模板会用到，
        // 却因为 preset 素材混排出现在每个用户的素材库里，还删不掉。种回来比留着更糟，所以直接不种。
        // 需要恢复这两个模板时，连同下面两行一起恢复。
    }

    private void seed(String templateId, String assetId, String label, String resource) throws Exception {
        byte[] bytes;
        try (var input = new ClassPathResource(resource).getInputStream()) { bytes = input.readAllBytes(); }
        var asset = assets.ensureBundledPreset(assetId, label, "tail", bytes);
        if (reseed) templates.replaceTailClip(templateId, asset);
        else templates.attachTailClipIfMissing(templateId, asset);
    }
}
