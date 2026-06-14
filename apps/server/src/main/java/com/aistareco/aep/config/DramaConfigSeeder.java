package com.aistareco.aep.config;

import com.aistareco.aep.service.PlatformConfigService;
import com.fasterxml.jackson.databind.node.IntNode;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 短剧专区个性化配置（v0.66）：admin「短剧专区 · 个性化配置」页可改，
 * 存 PlatformConfig（key 前缀 {@code drama.}），server 侧经 getLong 读取（带默认值兜底）。
 *
 * 幂等：已存在的 key 不覆盖（admin 改过的值不会被重置）。
 */
@Component
@Order(58)
public class DramaConfigSeeder implements CommandLineRunner {

    /** 消耗 ≥ 该值才弹确认框；小额免打扰直接执行。 */
    public static final String KEY_CONFIRM_THRESHOLD = "drama.credit.confirm-threshold";
    public static final String KEY_OUTLINE_TRIAL = "drama.credit.outline-trial";
    public static final String KEY_OUTLINE_FULL = "drama.credit.outline-full";
    public static final String KEY_EPSCRIPT = "drama.credit.epscript";
    public static final String KEY_SPLIT_SCENE = "drama.credit.split-scene";
    public static final String KEY_CAST = "drama.credit.cast";
    public static final String KEY_FRAME = "drama.credit.frame";
    /** 进短视频工作台开拍（新建草稿即 AI 出口播脚本与分镜）单次积分。 */
    public static final String KEY_SHORT_ENTRY = "drama.credit.short-entry";

    private final PlatformConfigService configs;

    public DramaConfigSeeder(PlatformConfigService configs) {
        this.configs = configs;
    }

    @Override
    public void run(String... args) {
        configs.seedIfAbsent(KEY_CONFIRM_THRESHOLD, IntNode.valueOf(10),
                "短剧 · 扣费确认弹窗阈值（积分）：消耗 ≥ 该值才弹确认，小额免打扰直接执行");
        configs.seedIfAbsent(KEY_OUTLINE_TRIAL, IntNode.valueOf(6), "短剧 · 大纲试铺（前 6 集）单次积分");
        configs.seedIfAbsent(KEY_OUTLINE_FULL, IntNode.valueOf(18), "短剧 · 大纲完整设计单次积分");
        configs.seedIfAbsent(KEY_EPSCRIPT, IntNode.valueOf(10), "短剧 · 整集分场分镜 AI 重写单次积分");
        configs.seedIfAbsent(KEY_SPLIT_SCENE, IntNode.valueOf(6), "短剧 · 单场拆镜单次积分");
        configs.seedIfAbsent(KEY_CAST, IntNode.valueOf(5), "短剧 · 从大纲重抽角色单次积分");
        configs.seedIfAbsent(KEY_FRAME, IntNode.valueOf(2), "短剧 · 分镜首帧渲染单次积分（一次出多版仍按单次计）");
        configs.seedIfAbsent(KEY_SHORT_ENTRY, IntNode.valueOf(10),
                "短视频 · 进工作台开拍单次积分（新建一条短视频草稿 = AI 出口播脚本与分镜；从创意市场套用单集创意同样计费）");
    }
}
