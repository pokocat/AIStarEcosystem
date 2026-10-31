package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Presentation only: a policy error does not by itself identify the prompt, a reference, or the output. */
public final class ProviderContentModeration {
    private static final Set<String> GENERIC_CODES = Set.of(
            "content_policy_violation", "content_filter", "content_policy", "safety_violation", "moderation_blocked");
    private static final List<String> WRAPPERS = List.of(
            "error", "errors", "Error", "ResponseMetadata", "responseMetadata", "data", "result", "response", "metadata", "FailureReason");
    private static final String REJECTED = "[^。；;.!?]{0,40}(?:未通过|违反|涉及|敏感|blocked|rejected|flagged|viola)";
    private static final Pattern IMAGE = Pattern.compile("(?i)(?:参考(?:图|图片)|输入(?:图|图片|图像)|(?:input|reference) images?)" + REJECTED);
    private static final Pattern TEXT = Pattern.compile("(?i)(?:提示词|输入文本|文本提示|input text|text prompt|the prompt)" + REJECTED);
    private static final Pattern OUTPUT = Pattern.compile("(?i)(?:(?:生成的|输出的)(?:图片|图像|视频|内容)|generated (?:image|video|content)|output (?:image|video|content))" + REJECTED);
    public static final String LEGACY_PREFIX = "图片未通过生成服务的内容审核：";
    private ProviderContentModeration() {}

    public record Finding(String providerCode, String target, String topic) {
        public String message() {
            String hint = topic.isEmpty() ? "" : "服务方提示可能涉及" + topic + "。";
            return switch (target) {
                case "reference_image" -> "参考图片未通过内容审核。" + hint + "请检查或更换参考图片后再生成。";
                case "reference_video" -> "参考视频未通过内容审核。" + hint + "请检查或更换参考视频后再生成。";
                case "reference_audio" -> "参考音频未通过内容审核。" + hint + "请检查或更换参考音频后再生成。";
                case "prompt" -> "输入文本未通过内容审核。" + hint + "请修改生成描述或文案后再生成。";
                case "output" -> "生成结果未通过内容审核。" + hint + "请调整生成描述或参考素材后再生成。";
                case "input" -> "输入内容未通过内容审核。" + hint + "请检查生成描述和参考素材。";
                default -> "本次生成未通过内容审核。" + hint + "服务方未说明触发对象，请检查参考素材和生成描述。";
            };
        }
    }

    public static Finding find(JsonNode body) { return find(body, 0); }

    private static Finding find(JsonNode node, int depth) {
        if (node == null || depth > 5) return null;
        if (node.isArray()) {
            for (JsonNode item : node) {
                Finding finding = find(item, depth + 1);
                if (finding != null) return finding;
            }
            return null;
        }
        if (!node.isObject()) return null;
        for (String key : WRAPPERS) {
            Finding nested = find(node.path(key), depth + 1);
            if (nested != null) return nested;
        }
        String code = "";
        for (String field : List.of("code", "Code", "errorCode", "error_code", "failCode", "fail_code", "providerCode"))
            if (node.path(field).isTextual() && !node.path(field).asText().isBlank()) { code = node.path(field).asText(); break; }
        String lower = code.toLowerCase(Locale.ROOT);
        boolean image = lower.startsWith("inputimagesensitivecontentdetected");
        boolean text = lower.startsWith("inputtextsensitivecontentdetected");
        boolean video = lower.startsWith("inputvideosensitivecontentdetected"), audio = lower.startsWith("inputaudiosensitivecontentdetected");
        boolean output = lower.startsWith("outputimagesensitivecontentdetected") || lower.startsWith("outputvideosensitivecontentdetected")
                || lower.startsWith("outputtextsensitivecontentdetected") || lower.startsWith("outputaudiosensitivecontentdetected");
        if (!GENERIC_CODES.contains(lower) && !image && !text && !video && !audio && !output) return null;
        String stage = node.path("moderation_details").path("moderation_stage").asText("");
        String reason = node.path("message").asText(node.path("Message").asText(node.path("Msg").asText(node.path("reason").asText(""))));
        String param = node.path("param").asText("").toLowerCase(Locale.ROOT);
        String target;
        // Stage describes what was actually blocked. A request field is not evidence that output moderation was input moderation.
        if ("output".equals(stage)) target = "output";
        else if (output) target = "input".equals(stage) ? "input" : "output";
        else if (image) target = "reference_image";
        else if (video) target = "reference_video";
        else if (audio) target = "reference_audio";
        else if (text) target = "prompt";
        else if (param.matches("(?:image|images|input_image|input_images|input_image_url|input_image_urls|reference_image|reference_images)(?:\\[\\d*])?")) target = "reference_image";
        else if (Set.of("prompt", "text", "input_text").contains(param)) target = "prompt";
        else {
            // Explicit subject wording is useful; the proxy's boilerplate 「该提示」 is not a synonym for 提示词.
            boolean namedImage = IMAGE.matcher(reason).find(), namedText = TEXT.matcher(reason).find(), namedOutput = OUTPUT.matcher(reason).find();
            target = namedOutput && !namedImage && !namedText && !"input".equals(stage) ? "output"
                    : namedImage && !namedText && !namedOutput ? "reference_image"
                    : namedText && !namedImage && !namedOutput ? "prompt"
                    : "input".equals(stage) ? "input" : "unknown";
        }
        String evidence = lower + " " + reason + " " + node.path("moderation_details").path("categories");
        return new Finding(code.matches("[A-Za-z0-9_.:-]{1,96}") ? code : "", target, topic(evidence));
    }

    private static String topic(String evidence) {
        String lower = evidence.toLowerCase(Locale.ROOT);
        if (lower.contains("violence") || lower.contains("violent") || lower.contains("暴力")) return "暴力内容";
        if (lower.contains("self-harm") || lower.contains("self_harm") || lower.contains("自伤")) return "自伤相关内容";
        if (lower.contains("sexual") || lower.contains("色情")) return "色情内容";
        if (lower.contains("harassment") || lower.contains("骚扰")) return "骚扰内容";
        if (lower.contains("未成年") || lower.contains("青少年") || lower.contains("儿童")) return "未成年人相关内容";
        return "";
    }

    /** Old public errors have already lost structured provenance; do not manufacture it on read. */
    public static String historical(String text) {
        if (text == null) return null;
        int prefix = text.indexOf(LEGACY_PREFIX);
        if (prefix < 0) return text;
        String reason = text.substring(prefix + LEGACY_PREFIX.length());
        boolean image = IMAGE.matcher(reason).find(), prompt = TEXT.matcher(reason).find(), output = OUTPUT.matcher(reason).find();
        String target = image && !prompt && !output ? "reference_image" : prompt && !image && !output ? "prompt"
                : output && !image && !prompt ? "output" : "unknown";
        return text.substring(0, prefix) + new Finding("", target, topic(reason)).message();
    }
}
