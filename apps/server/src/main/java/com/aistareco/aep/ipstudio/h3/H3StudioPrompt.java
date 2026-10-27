package com.aistareco.aep.ipstudio.h3;

import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.VideoSettings;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.List;

/**
 * Studio 画布 / 创作助手出 H3 视频时的改写输入：按提交给 H3 的顺序列参考素材（名字取画布上那个节点的标题），
 * 认台词，定镜头。原文按导演台的写法写（「第1镜（0–3 秒）」「某某说：「…」」，创作助手照这个写）时镜头固定、台词由代码填；
 * 用户自己写的提示词由模型定镜头、照官方写法写台词。
 */
public final class H3StudioPrompt {
    private H3StudioPrompt() {}

    /** 改写请求与参考素材数量（核对标签用）。 */
    public record Built(H3PromptRewrite.Request request, int pictures, int videos, int audios) {}

    public static Built build(String prompt, int seconds, VideoSettings video, JsonNode doc) {
        H3PromptRewrite.Mode mode = H3PromptRewrite.Mode.of(video.mode());
        List<String> refs = new ArrayList<>();
        int pictures = 0, videos = 0, audios = 0;
        if (video.firstFrameKey() != null && mode != H3PromptRewrite.Mode.T2V)
            refs.add("<Picture " + (++pictures) + ">: the first frame of the target video" + named(doc, video.firstFrameKey()) + ".");
        if (video.lastFrameKey() != null && mode == H3PromptRewrite.Mode.FL2V)
            refs.add("<Picture " + (++pictures) + ">: the last frame of the target video" + named(doc, video.lastFrameKey()) + ".");
        if (mode == H3PromptRewrite.Mode.REF && video.references() != null) for (var r : video.references()) {
            switch (r.mediaType() == null ? "image" : r.mediaType()) {
                case "video" -> refs.add("<Video " + (++videos) + ">: reference video" + named(doc, r.key()) + ".");
                case "audio" -> refs.add("<Audio " + (++audios) + ">: reference audio" + named(doc, r.key()) + "; use only its timbre and delivery.");
                default -> refs.add("<Picture " + (++pictures) + ">: reference image" + named(doc, r.key()) + ".");
            }
        }
        String zh = prompt == null ? "" : prompt;
        H3PromptRewrite.Source src = H3PromptRewrite.source(zh, List.of("旁白"));
        boolean codeLines = !src.lines().isEmpty() && H3PromptRewrite.quotesBalanced(src.text(), !src.text().contains("说：{{"));
        if (!codeLines) src = new H3PromptRewrite.Source(zh, List.of());
        List<Double> starts = H3PromptRewrite.shotStarts(zh, seconds);
        var request = new H3PromptRewrite.Request(mode, seconds, refs, src, codeLines, starts == null ? null : starts.size(), starts, null, false);
        return new Built(request, pictures, videos, audios);
    }

    /** 画布上这个素材节点的标题（「「林小雅定妆照」」），找不到就不写名字。 */
    private static String named(JsonNode doc, String storageKey) {
        if (doc == null || storageKey == null) return "";
        for (JsonNode n : doc.path("nodes")) {
            if (!storageKey.equals(n.path("metadata").path("storageKey").asText())) continue;
            String title = n.path("title").asText("").strip();
            return title.isEmpty() ? "" : " 「" + (title.length() > 40 ? title.substring(0, 40) : title) + "」";
        }
        return "";
    }
}
