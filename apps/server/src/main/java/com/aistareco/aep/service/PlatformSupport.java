package com.aistareco.aep.service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

/**
 * 子产品平台访问隔离的纯函数工具（无 Spring 依赖，DTO 可直接静态调用）。
 *
 * 平台 = 四个子产品：{@code music}（AI 音乐人） / {@code drama}（AI 短剧） /
 * {@code celebrity}（AI 明星带货） / {@code aiavatar}（数字人资产平台，v0.53+）。
 * 一个账号可被授予其中若干个平台的访问权，字段以 CSV 形式落在 {@code aep_users.platforms}。
 */
public final class PlatformSupport {

    private PlatformSupport() {}

    public static final String MUSIC = "music";
    public static final String DRAMA = "drama";
    public static final String CELEBRITY = "celebrity";
    /** v0.53+: web-aiavatar 数字人资产平台纳入平台门禁。 */
    public static final String AIAVATAR = "aiavatar";

    /** 平台全集（注册顺序即展示顺序）。 */
    public static final List<String> ALL = List.of(MUSIC, DRAMA, CELEBRITY, AIAVATAR);

    /** 把 CSV 解析为干净的平台列表（去空格 / 去空项 / 去重 / 仅保留已知平台 / 保序）。 */
    public static List<String> parse(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String raw : csv.split(",")) {
            String p = raw.trim().toLowerCase(Locale.ROOT);
            if (ALL.contains(p)) out.add(p);
        }
        return new ArrayList<>(out);
    }

    /**
     * 有效平台：显式配置了就用配置；为空（老账号 / 未回填）则按「全部可访问」兜底，
     * 避免历史账号被锁在门外。开发阶段「一个平台注册 3 平台都用」也落在这条路径上。
     */
    public static List<String> effective(String csv) {
        List<String> parsed = parse(csv);
        return parsed.isEmpty() ? ALL : parsed;
    }

    /** 列表转 CSV（清洗 + 仅保留已知平台）；空集返回 null。 */
    public static String toCsv(Collection<String> platforms) {
        if (platforms == null || platforms.isEmpty()) return null;
        String csv = platforms.stream()
                .map(p -> p == null ? "" : p.trim().toLowerCase(Locale.ROOT))
                .filter(ALL::contains)
                .distinct()
                .collect(Collectors.joining(","));
        return csv.isBlank() ? null : csv;
    }

    /** 该账号是否可访问某子产品（空配置 = 全部可访问）。 */
    public static boolean canAccess(String csv, String platform) {
        if (platform == null) return true;
        return effective(csv).contains(platform.trim().toLowerCase(Locale.ROOT));
    }
}
