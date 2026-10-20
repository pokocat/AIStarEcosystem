package com.aistareco.aep.service.materialvideo;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * 厂商出片前改写提示词的结果（聚算 H3 的 {@code promptOptimization}）。
 *
 * <p>H3 在受理生成任务之后、开始出片之前，会先把提示词改写一遍（公开契约：H3 四种模式缺省开启，
 * 生成请求带 {@code optimizePrompt=false} 才跳过）。改写后的描述就是模型真正照着出片的那份，
 * 和用户写的可能差很多 —— 2026-10-20 线上一条任务，中文对白「你说我得了话癌，我都没听过这个病」
 * 在改写后只剩「什么」两个字。不留下这份描述，用户和我们都只能对着成片猜。
 *
 * <p>这里是唯一的一处：从查询响应解析（{@link #fromVendor}）、存进任务的 {@code payload_json}
 * （{@link #PAYLOAD_KEY}，只读旁路，不影响出片与结算）、投影给画布（{@link #wire}）。
 * 改写发生在付费任务受理之后，所以它只能**事后**解释差异，不能当成生成前的拦截。
 *
 * @param status  厂商的改写状态：pending / processing / resolving / succeeded / failed
 * @param source  厂商最终用的是哪份：optimized = 改写后的；其他值按原文处理
 * @param prompt  厂商实际用的描述（effectivePrompt，缺省读 optimizedPrompt）；没改写时为 null
 * @param optimizationId 厂商的改写记录号（只留库排障，不出 wire）
 * @param version 厂商改写器版本（同上）
 */
public record VideoPromptRewrite(String status, String source, String prompt, String optimizationId, String version) {

    /** 存在 {@code material_video_job.payload_json} 里的键。 */
    public static final String PAYLOAD_KEY = "vendor_prompt";
    /** 厂商单条提示词上限 7000 字，多留一点余量；再长就是响应异常，截断后照存，不影响出片。 */
    static final int MAX_PROMPT_CHARS = 8000;

    /** 查询响应里的 {@code promptOptimization} 对象；没有这个对象（模型不改写、或请求关掉了改写）→ null。 */
    public static VideoPromptRewrite fromVendor(JsonNode root) {
        JsonNode node = root == null ? null : root.get("promptOptimization");
        if (node == null || !node.isObject()) return null;
        String source = text(node, "promptSource");
        String prompt = text(node, "effectivePrompt");
        if (prompt == null) prompt = text(node, "optimizedPrompt");
        if (prompt != null && prompt.length() > MAX_PROMPT_CHARS) prompt = prompt.substring(0, MAX_PROMPT_CHARS);
        return new VideoPromptRewrite(text(node, "status"), source, prompt,
                text(node, "optimizationId"), text(node, "optimizationVersion"));
    }

    public ObjectNode toJson(ObjectMapper om) {
        ObjectNode out = om.createObjectNode();
        if (status != null) out.put("status", status);
        if (source != null) out.put("source", source);
        if (prompt != null) out.put("prompt", prompt);
        if (optimizationId != null) out.put("optimizationId", optimizationId);
        if (version != null) out.put("version", version);
        return out;
    }

    static VideoPromptRewrite fromJson(JsonNode node) {
        if (node == null || !node.isObject()) return null;
        return new VideoPromptRewrite(text(node, "status"), text(node, "source"), text(node, "prompt"),
                text(node, "optimizationId"), text(node, "version"));
    }

    /**
     * 画布看到的只读投影（{@code IpVideoCandidate.promptRewrite}）：
     * <ul>
     *   <li>{@code off}：提交时选了「按原文生成」，厂商没有改写；</li>
     *   <li>{@code running}：厂商正在改写，还没开始出片；</li>
     *   <li>{@code done}：改写结束，{@code prompt} 是厂商实际用的描述（用的是原文时不带）；</li>
     *   <li>{@code failed}：厂商改写失败（这时任务本身也会失败，H3 不回退原文）。</li>
     * </ul>
     * 模型不改写或老任务没有记录 → null（不出这个字段）。内部记录号不出 wire。
     */
    public static ObjectNode wire(ObjectMapper om, String variantConfigJson, String payloadJson) {
        if (Boolean.FALSE.equals(VideoGenSpec.fromVariantConfigJson(variantConfigJson).optimizePrompt()))
            return om.createObjectNode().put("state", "off");
        VideoPromptRewrite rewrite = fromPayload(om, payloadJson);
        if (rewrite == null || rewrite.status() == null) return null;
        ObjectNode out = om.createObjectNode();
        switch (rewrite.status()) {
            case "succeeded" -> {
                out.put("state", "done");
                if ("optimized".equals(rewrite.source()) && rewrite.prompt() != null) out.put("prompt", rewrite.prompt());
            }
            case "failed" -> out.put("state", "failed");
            default -> out.put("state", "running");
        }
        return out;
    }

    static VideoPromptRewrite fromPayload(ObjectMapper om, String payloadJson) {
        if (payloadJson == null || payloadJson.isBlank()) return null;
        try {
            return fromJson(om.readTree(payloadJson).get(PAYLOAD_KEY));
        } catch (Exception e) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.get(field);
        return v == null || !v.isTextual() || v.asText().isBlank() ? null : v.asText();
    }
}
