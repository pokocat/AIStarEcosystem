package com.aistareco.aep.service.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.List;
import java.util.regex.Pattern;

/** Customer error presentation only. Never changes stored evidence, recovery classification or wallet errors. */
public final class PublicModelErrorPolicy {
    public static final String UNAVAILABLE = "生成服务暂时不可用，请稍后再试或联系平台处理。";
    /**
     * The supplier's own storage on our account is full (聚算 personal_asset_quota_exceeded: 「个人资源空间不足，请清理资源
     * (含回收站)或扩容后重试」). Passed through, that told customers to delete their own work, which cannot help.
     */
    public static final String SUPPLIER_STORAGE_FULL =
            "生成服务的存储空间满了，这次没有生成成功。问题出在平台这边，删作品或清空回收站都没有用。已经做好的内容都还在，请联系客服，恢复后重试这一步就行。";
    private static final Pattern SUPPLIER_STORAGE = Pattern.compile("(?i)资源空间|存储空间|空间不足|清理资源|回收站|扩容|asset[_ ]?quota|storage[_ ]?quota");
    private static final Pattern ACCOUNT = Pattern.compile(
            "(?i)余额|额度|配额|预扣|扣费|计费|费率|定价|成本|充值|单价|收费|账户权益|账户欠费|balance|quota|billing|credits?|pricing|payment|\\b(?:costs?|budgets?|fees?|funds?)\\b|insufficient[_ -]?funds|(?:USD|CNY|RMB|[¥￥$])\\s*[0-9]");
    private static final Pattern PRIVATE = Pattern.compile(
            "(?i)预扣费|用户剩余额度|供应商.{0,12}(?:余额|额度|账户)|服务方.{0,12}(?:余额|额度|账户)|(?:api[_ -]?key|authorization|secret|credential)\\s*[:=]|invalid api[ _-]?key|incorrect api[ _-]?key|鉴权失败|密钥无效|无可用渠道|no available channel|Bearer\\s+|https?://|渠道.{0,12}(?:余额|额度|密钥)|Traceback|java\\.[a-z]+\\.|at com\\.");
    private static final Pattern CONTEXT = Pattern.compile("(?i)上游|供应商|服务方|生成服务|模型服务|模型端|数字人服务|引擎|provider|upstream|channel");
    private static final Pattern CODE = Pattern.compile("(?i)^(?:AI_(?:CALL|PROVIDER)|IMAGE_|VIDEO_|MUSIC_|DAP_MODEL_|STUDIO_(?:IMAGE|SPEECH|LIP_SYNC)|CLIP_ENGINE_|DRAMA_(?:IMAGE|VIDEO|RENDER|AI)).*");
    private static final Pattern COST = Pattern.compile("(?i)(?:USD|CNY|RMB|[¥￥$])\\s*[+-]?(?:[0-9]|\\.[0-9])");
    private static final Pattern WALLET = Pattern.compile("^(?:PAYMENT_REQUIRED|STUDIO_PAYMENT_REQUIRED|STUDIO_USAGE_PENDING|INSUFFICIENT_CREDITS|INSUFFICIENT_BALANCE|BALANCE_INSUFFICIENT|(?:CREDITS?|WALLET|RECHARGE|WITHDRAW|ENTERPRISE_(?:POINTS|CREDITS?))_.*)$");
    private static final Pattern TRACE = Pattern.compile("(?:[·。]\\s*)?追查号[：:\\s]+([A-HJ-NP-Z2-9]{12})(?:\\s*[—-].*)?$");
    private static final Pattern EXTERNAL_ID = Pattern.compile("(?i)\\s*\\(?\\b(?:request|trace|log)[ _-]?id\\s*[:=]\\s*(?:\\[已脱敏\\]|[A-Za-z0-9_.:-]+)\\)?");
    private PublicModelErrorPolicy() {}

    /** Used only on actual supplier messages: their balances/quotas are never the customer's wallet. */
    public static String upstream(String text) {
        if (text == null) return null;
        if (SUPPLIER_STORAGE.matcher(text).find()) return SUPPLIER_STORAGE_FULL;
        if (PRIVATE.matcher(text).find() || ACCOUNT.matcher(text).find()) return UNAVAILABLE;
        return EXTERNAL_ID.matcher(text).replaceAll("").strip();
    }

    /** Read-time guard for already persisted errors; preserve our own logId and real customer credit messages. */
    public static String stored(String text, String code) {
        if (text == null || text.isBlank()) return text;
        boolean provider = code != null && CODE.matcher(code).matches() || CONTEXT.matcher(text).find();
        boolean wallet = code != null && WALLET.matcher(code).matches();
        if (provider && !wallet && SUPPLIER_STORAGE.matcher(text).find()) {
            var trace = TRACE.matcher(text);
            return trace.find() ? SUPPLIER_STORAGE_FULL + " · 追查号 " + trace.group(1) : SUPPLIER_STORAGE_FULL;
        }
        if (!PRIVATE.matcher(text).find() && !(!wallet && (COST.matcher(text).find() || provider && ACCOUNT.matcher(text).find()))) {
            String normalized = ProviderContentModeration.historical(text);
            if (normalized.equals(text)) return text;
            var trace = TRACE.matcher(text);
            return trace.find() ? normalized + " · 追查号 " + trace.group(1) : normalized;
        }
        var trace = TRACE.matcher(text);
        return trace.find() ? UNAVAILABLE + " · 追查号 " + trace.group(1) : UNAVAILABLE;
    }

    /** Traverse error fields on a response copy; customer content/amounts stay unchanged, private diagnostics are omitted. */
    public static JsonNode response(JsonNode input) {
        if (input == null) return null;
        JsonNode copy = input.deepCopy();
        scrub(copy, false, null);
        return copy;
    }

    private static void scrub(JsonNode node, boolean inError, String inheritedCode) {
        if (node instanceof ArrayNode array) {
            for (int i = 0; i < array.size(); i++) {
                if (inError && array.get(i).isTextual()) array.set(i, com.fasterxml.jackson.databind.node.TextNode.valueOf(stored(array.get(i).asText(), inheritedCode)));
                else scrub(array.get(i), inError, inheritedCode);
            }
            return;
        }
        if (!(node instanceof ObjectNode object)) return;
        if (inError) object.remove(List.of("upstreamBody", "upstreamMessage", "providerMessage", "responseBody", "rawResponse", "internalDetail", "apiKey", "credentials"));
        if (inError && "content_moderation".equals(object.path("category").asText()) && object.hasNonNull("providerCode") && !object.hasNonNull("target")) {
            var moderation = ProviderContentModeration.find(object);
            if (moderation != null) {
                for (String field : List.of("reason", "message"))
                    if (object.path(field).isTextual()) {
                        var trace = TRACE.matcher(object.path(field).asText());
                        object.put(field, moderation.message() + (trace.find() ? " · 追查号 " + trace.group(1) : ""));
                    }
                object.put("target", moderation.target());
            }
        }
        String code = object.path("errorCode").asText(object.path("error_code").asText(inheritedCode));
        if (inError) code = object.path("code").asText(code);
        if (inError && code != null && CODE.matcher(code).matches())
            object.remove(List.of("balance", "remainingQuota", "requiredQuota", "providerBalance", "supplierBalance", "accountBalance", "upstreamBalance", "upstreamCost", "providerPrice"));
        for (String name : List.of("errorMessage", "error_message", "errorDetails", "failReason", "fail_reason", "lastError", "textError", "planError", "needsUserReason", "failureReason"))
            if (object.path(name).isTextual()) object.put(name, stored(object.path(name).asText(), code));
        if (inError) for (String name : List.of("message", "reason", "detail", "description"))
            if (object.path(name).isTextual()) object.put(name, stored(object.path(name).asText(), code));
        // Top-level structured operation errors sometimes use {code,message} without an "error" wrapper.
        if (object.path("code").isTextual() && object.path("message").isTextual())
            object.put("message", stored(object.path("message").asText(), object.path("code").asText()));
        if (List.of("failed", "error", "rejected", "needs_user", "waiting", "blocked", "paused").contains(object.path("status").asText()) && object.path("message").isTextual())
            object.put("message", stored(object.path("message").asText(), code));
        final String nextCode = code;
        object.fields().forEachRemaining(e -> {
            boolean error = inError || List.of("error", "errors", "lastError", "textError", "planError").contains(e.getKey());
            if ("error".equals(e.getKey()) && e.getValue().isTextual()) object.put(e.getKey(), stored(e.getValue().asText(), nextCode));
            else scrub(e.getValue(), error, nextCode);
        });
    }
}
