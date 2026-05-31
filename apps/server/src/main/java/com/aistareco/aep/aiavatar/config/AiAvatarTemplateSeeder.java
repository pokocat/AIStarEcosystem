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
import java.util.ArrayList;
import java.util.List;

/**
 * AiAvatar 工厂模板种子（AI 模板中心初始数据）。幂等：官方模板非空则跳过。
 * 不受 aep.seed.dev-data 开关控制 —— 工厂模板是平台基础数据，生产也需要（沿用 MixcutPresetSeeder 惯例）。
 *
 * v0.46+: params 形态与 web-aiavatar 出厂常量 / 运营配置消费屏严格对齐 —— 6 美颜 + 6 风格 + 6 构图：
 *   BEAUTY      → {smooth,whiten,warmth,brightness,hue}   （精调美颜模板，客户端 canvas beauty）
 *   STYLE       → {prompt,hue} + thumbnailUrl(样片)        （精调风格/妆造模板，img2img）
 *   COMPOSITION → {shot,ratio,main}                        （分视角出图标准构图）
 * 运营在 web-aiavatar /config 增删改的是同一张 aiavatar_template 表。
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
        if (repo.countByOfficialTrue() > 0) return;
        List<AiAvatarTemplate> seeds = new ArrayList<>();

        // —— 美颜 / 美化（BEAUTY）——
        seeds.add(beauty("主播美颜", "通用", 28, 55, 30, 12, 56));
        seeds.add(beauty("高清质感", "细节", 200, 30, 8, 0, 54));
        seeds.add(beauty("冷白皮", "肤色", 220, 42, 70, -22, 60));
        seeds.add(beauty("复古滤镜", "色调", 38, 35, 12, 38, 48));
        seeds.add(beauty("奶油雾面", "色调", 18, 60, 30, 18, 58));
        seeds.add(beauty("通透裸妆", "妆容", 340, 38, 22, 6, 55));

        // —— 风格 / 妆造（STYLE）——
        seeds.add(style("职业妆容", "干练通勤 · 自然底妆", "职业通勤妆容，自然底妆，知性干练气质，保留五官结构", "/seed/looks/look-pro.jpg", 200));
        seeds.add(style("国风古韵", "古典发饰 · 东方妆造", "国风古典妆造，古典发饰与服饰，东方韵味，保留五官结构", "/seed/looks/look-guofeng.jpg", 340));
        seeds.add(style("轻奢氛围", "高级感 · 质感妆容", "轻奢高级感妆容，质感光影，时尚氛围，保留五官结构", "/seed/looks/look-lux.jpg", 38));
        seeds.add(style("二次元渲染", "动漫风 · 通透大眼", "二次元动漫渲染风格，通透大眼，干净光影，保留五官结构", "/seed/looks/look-2d.jpg", 268));
        seeds.add(style("港风复古", "复古胶片 · 浓颜", "港风复古妆容，胶片质感，浓颜立体，保留五官结构", "/seed/looks/look-gangfeng.jpg", 12));
        seeds.add(style("校园清新", "清透裸妆 · 元气", "校园清新风，清透裸妆，元气自然，保留五官结构", "/seed/looks/look-fresh.jpg", 88));

        // —— 标准构图（COMPOSITION）——
        seeds.add(composition("正面半身像", "front_bust", "3:4", true));
        seeds.add(composition("正面全身像", "front_full", "9:16", false));
        seeds.add(composition("左侧脸特写", "left_profile", "1:1", false));
        seeds.add(composition("右侧脸特写", "right_profile", "1:1", false));
        seeds.add(composition("微笑表情", "expression", "1:1", false));
        seeds.add(composition("平静表情", "expression", "1:1", false));

        repo.saveAll(seeds);
        log.info("[aiavatar-seed] seeded {} factory templates (6 beauty + 6 style + 6 composition)", seeds.size());
    }

    private static String esc(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private AiAvatarTemplate beauty(String name, String tag, int hue, int smooth, int whiten, int warmth, int brightness) {
        String params = String.format("{\"smooth\":%d,\"whiten\":%d,\"warmth\":%d,\"brightness\":%d,\"hue\":%d}",
                smooth, whiten, warmth, brightness, hue);
        return tpl(name, AiAvatarTemplateCategory.BEAUTY, AiAvatarCapability.RESTORE, tag, params, null);
    }

    private AiAvatarTemplate style(String name, String desc, String prompt, String sampleUrl, int hue) {
        String params = String.format("{\"prompt\":\"%s\",\"hue\":%d}", esc(prompt), hue);
        return tpl(name, AiAvatarTemplateCategory.STYLE, AiAvatarCapability.IMG2IMG, desc, params, sampleUrl);
    }

    private AiAvatarTemplate composition(String name, String shot, String ratio, boolean main) {
        String params = String.format("{\"shot\":\"%s\",\"ratio\":\"%s\",\"main\":%b}", shot, ratio, main);
        return tpl(name, AiAvatarTemplateCategory.COMPOSITION, null, null, params, null);
    }

    private AiAvatarTemplate tpl(String name, AiAvatarTemplateCategory cat, AiAvatarCapability cap, String desc, String params, String thumbnailUrl) {
        return AiAvatarTemplate.builder()
                .id("dhtpl-" + Integer.toHexString(name.hashCode()))
                .name(name)
                .category(cat)
                .capability(cap)
                .description(desc)
                .thumbnailUrl(thumbnailUrl)
                .paramsJson(params)
                .official(true)
                .enabled(true)
                .usageCount(0)
                .createdAt(OffsetDateTime.now())
                .updatedAt(OffsetDateTime.now())
                .build();
    }
}
