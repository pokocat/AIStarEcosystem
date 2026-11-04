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
    /** Shown when a supplier refused in words that tell a customer nothing; the original stays in the logs. */
    public static final String UNREADABLE = "生成服务未能完成这次请求，请稍后再试或换一个模型。";
    private static final String OLD_SUBMISSION_PREFIX = "生成服务没有返回有效的任务信息";
    private static final Pattern HAN = Pattern.compile("\\p{IsHan}");
    /** Supplier internals, even inside a Chinese sentence: Go/JSON dumps, 幂等键, plan names, status codes, field names. */
    private static final Pattern TECHNICAL = Pattern.compile(
            "(?i)map\\[|[{}]|幂等|idempot|\\bapi\\b|token plan|exception\\b|\\b(?:http|status)\\s*[:=]?\\s*\\d{3}\\b|\\b[a-z]+_[a-z_]+\\b");
    /** For saved messages, which may be our own Chinese sentences that fairly mention "API Key" or "HTTP 404": only what can never be ours. */
    private static final Pattern DUMP = Pattern.compile("(?i)map\\[|[{}]|幂等|idempot|exception\\b|\\b[a-z]+_[a-z_]+\\b");
    /** True but empty: says nothing about what to change. */
    private static final Pattern NO_INFORMATION = Pattern.compile(
            "(?i)\\s*(?:(?:(?:resource|model|task) )?not found|bad request|invalid request|request failed|(?:internal )?(?:server )?error|unknown error|(?:service )?unavailable|forbidden|unauthorized|failed)\\s*\\.?\\s*");
    private static final Pattern DURATION = Pattern.compile("(?i)reference video duration must be within (\\d+)\\.\\.(\\d+) seconds");
    private static final Pattern PERSON = Pattern.compile("(?i)may contain real person");
    private static final Pattern RETIRED = Pattern.compile("(?i)has been retired|model_delisted");
    private static final Pattern BUSY = Pattern.compile("(?i)rate.?limit|too many requests|overloaded|速率限制");
    private static final Pattern UNREADABLE_MEDIA = Pattern.compile("(?i)cannot be decoded|invalid image|unsupported (?:image|format|media)");
    private PublicModelErrorPolicy() {}

    /** The supplier reasons we can state exactly, in our own words. Plain English we cannot state stays as a hint, see {@link #withHint}. */
    private static String translate(String text) {
        var duration = DURATION.matcher(text);
        if (duration.find()) return "参考视频要 " + duration.group(1) + "–" + duration.group(2) + " 秒，请调整后再试";
        if (PERSON.matcher(text).find()) return "参考图片被模型识别为包含真人，当前模型不接受这类素材。请更换参考图片后再试，使用相同素材重试仍会失败";
        if (RETIRED.matcher(text).find()) return "这个视频模型已被提供方下架，不能再用它生成，请换一个模型";
        if (BUSY.matcher(text).find()) return "生成服务当前请求过多，请稍后再试";
        if (UNREADABLE_MEDIA.matcher(text).find()) return "参考素材无法读取，请更换后再试";
        return null;
    }
    private static boolean usable(String text) {
        return !TECHNICAL.matcher(text).find() && !NO_INFORMATION.matcher(text).matches();
    }
    /**
     * A plain English reason can be what lets someone fix the request ("size must be one of 1024x1024"), so it stays, but
     * never as the whole message: our sentence comes first. A Chinese reason already reads as the message.
     */
    public static String withHint(String lead, String reason) {
        if (reason == null || lead != null && lead.contains(reason)) return lead;
        if (HAN.matcher(reason).find()) return reason;
        return (lead == null ? "" : lead.replaceAll("[。；]$", "")) + "（服务方提示：" + reason + "）";
    }
    /** Read-time form of an old provider error; returns the input unchanged when nothing needs rewording. */
    private static String reworded(String text) {
        var trace = TRACE.matcher(text);
        String body = trace.find() ? text.substring(0, trace.start()).strip() : text;
        if (body.startsWith(OLD_SUBMISSION_PREFIX)) return com.aistareco.aep.service.GenerationSubmissionFailure.MESSAGE;
        String translated = translate(body);
        if (translated != null) return translated;
        String cleaned = body.replaceAll("[（(](?:上游 ?|HTTP )\\d{3}[)）]", "").replace("被上游拒收", "被生成服务拒绝").replace("上游原因", "原因");
        if (!HAN.matcher(cleaned).find()) return usable(cleaned) ? withHint(UNREADABLE, cleaned) : UNREADABLE;
        if (DUMP.matcher(cleaned).find()) return UNREADABLE;
        return cleaned.equals(body) ? text : cleaned;
    }

    /** Used only on actual supplier messages: their balances/quotas are never the customer's wallet. */
    public static String upstream(String text) {
        if (text == null) return null;
        if (SUPPLIER_STORAGE.matcher(text).find()) return SUPPLIER_STORAGE_FULL;
        if (PRIVATE.matcher(text).find() || ACCOUNT.matcher(text).find()) return UNAVAILABLE;
        String cleaned = EXTERNAL_ID.matcher(text).replaceAll("").strip();
        String translated = translate(cleaned);
        if (translated != null) return translated;
        // Null lets the caller use its own sentence. The supplier's words stay in the logs (ProviderResponseDiagnostics).
        return usable(cleaned) ? cleaned : null;
    }

    /** Read-time guard for already persisted errors; preserve our own logId and real customer credit messages. */
    public static String stored(String text, String code) { return guard(text, code, true); }

    /** Our own sentence about a supplier failure: only the privacy guard, it is already in the right words. */
    public static String own(String text) { return guard(text, "AI_PROVIDER_ERROR", false); }

    private static String guard(String text, String code, boolean reword) {
        if (text == null || text.isBlank()) return text;
        boolean provider = code != null && CODE.matcher(code).matches() || CONTEXT.matcher(text).find();
        boolean wallet = code != null && WALLET.matcher(code).matches();
        if (provider && !wallet && SUPPLIER_STORAGE.matcher(text).find()) {
            var trace = TRACE.matcher(text);
            return trace.find() ? SUPPLIER_STORAGE_FULL + " · 追查号 " + trace.group(1) : SUPPLIER_STORAGE_FULL;
        }
        if (!PRIVATE.matcher(text).find() && !(!wallet && (COST.matcher(text).find() || provider && ACCOUNT.matcher(text).find()))) {
            String normalized = ProviderContentModeration.historical(text);
            if (reword && provider && !wallet) normalized = reworded(normalized);
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
