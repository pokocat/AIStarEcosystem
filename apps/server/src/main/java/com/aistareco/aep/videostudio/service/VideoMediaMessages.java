package com.aistareco.aep.videostudio.service;

import java.util.List;
import java.util.Locale;

/** What a user reads when a reference fails a model's media rule: which material, what the rule is, what it is now. */
public final class VideoMediaMessages {
    private VideoMediaMessages() {}

    public static String kind(String mediaType) {
        return switch (mediaType == null ? "" : mediaType) {
            case "image" -> "图片素材";
            case "video" -> "视频素材";
            case "audio" -> "声音素材";
            default -> "素材";
        };
    }
    public static String empty(String label) { return label + "是空文件，请重新上传"; }
    public static String tooLarge(String label, long maxBytes) {
        long mib = 1024L * 1024L;
        String limit = maxBytes % mib == 0 ? String.valueOf(maxBytes / mib) : String.format(Locale.ROOT, "%.1f", (double) maxBytes / mib);
        return label + "超过当前模型 " + limit + " MB 的上限，请压缩后再试";
    }
    public static String format(String label, List<String> formats) {
        return label + "的格式当前模型不支持，请换成 " + String.join("、", formats) + " 格式";
    }
    public static String duration(String label, double actualSec, Integer minSec, Integer maxSec) {
        String rule = minSec != null && maxSec != null ? "要 " + minSec + "–" + maxSec + " 秒"
                : minSec != null ? "至少要 " + minSec + " 秒" : "不能超过 " + maxSec + " 秒";
        String now = Double.isFinite(actualSec) && actualSec > 0 ? "，现在是 " + String.format(Locale.ROOT, "%.1f", actualSec) + " 秒" : "";
        return label + rule + now + "，请调整后再试";
    }
}
