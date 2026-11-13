package com.aistareco.aep.service.alerts;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

final class FeishuTaskCard {
    static final String TITLE = "【模型任务告警】";
    private static final String ADMIN = "https://admin.aibuzz.cn/admin/platform/ai-models";
    private static final String TRUNCATED = "\n…（响应过长，完整内容见后台请求日志）";
    private static final ObjectMapper JSON = new ObjectMapper();

    private final ObjectNode card = JSON.createObjectNode().put("schema", "2.0");
    private final com.fasterxml.jackson.databind.node.ArrayNode elements;

    FeishuTaskCard() {
        var header = card.putObject("header").put("template", "red");
        header.putObject("title").put("tag", "plain_text").put("content", TITLE);
        elements = card.putObject("body").putArray("elements");
    }

    void field(String label, String value) {
        text(label + "：" + (value == null || value.isBlank() ? "—" : value));
    }

    private ObjectNode text(String content) {
        return elements.addObject().put("tag", "div").putObject("text").put("tag", "plain_text").put("content", content);
    }

    private void button(String title, String url) {
        var button = elements.addObject().put("tag", "button").put("type", "default");
        button.putObject("text").put("tag", "plain_text").put("content", title);
        button.putArray("behaviors").addObject().put("type", "open_url").put("default_url", url);
    }

    String finish(String response, String page) {
        elements.addObject().put("tag", "hr");
        var body = text("服务方返回：" + (response.isBlank() ? "—" : "\n" + response));
        if (!page.isBlank()) button("打开报错页面", page);
        button("打开模型后台", ADMIN);
        if (!response.isBlank() && !fitsWebhook()) {
            int low = 0, high = response.codePointCount(0, response.length());
            while (low < high) {
                int mid = (low + high + 1) / 2;
                body.put("content", responseExcerpt(response, mid));
                if (fitsWebhook()) low = mid;
                else high = mid - 1;
            }
            body.put("content", responseExcerpt(response, low));
        }
        return card.toString();
    }

    private static String responseExcerpt(String response, int count) {
        return "服务方返回：\n" + response.substring(0, response.offsetByCodePoints(0, count)) + TRUNCATED;
    }

    private boolean fitsWebhook() {
        // The compact wrapper is the same byte length as the serialized Webhook request.
        return ("{\"msg_type\":\"interactive\",\"card\":" + card + "}").getBytes(java.nio.charset.StandardCharsets.UTF_8).length <= 20_000;
    }
}
