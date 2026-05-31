package com.aistareco.aep.aiavatar.provider.impl;

import com.aistareco.aep.aiavatar.model.AiAvatarCapability;
import com.aistareco.aep.aiavatar.model.AiAvatarProviderMode;
import com.aistareco.aep.aiavatar.provider.AbstractCapabilityProvider;
import com.aistareco.aep.aiavatar.provider.AiAvatarJobContext;
import com.aistareco.aep.aiavatar.provider.ProviderResult;
import com.aistareco.aep.aiavatar.service.AiAvatarStorage;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 人设文案解析 Mock（nlu）—— 把描述词启发式抽成结构化人设。
 * 真实路径见 {@link BackendNluProvider}（走平台 LLM 网关）。
 */
public class MockNluProvider extends AbstractCapabilityProvider {

    private static final Map<String, String> STYLE_HINTS = new LinkedHashMap<>();
    static {
        STYLE_HINTS.put("未来", "未来机能");
        STYLE_HINTS.put("机能", "未来机能");
        STYLE_HINTS.put("国风", "国风古典");
        STYLE_HINTS.put("古风", "国风古典");
        STYLE_HINTS.put("赛博", "赛博朋克");
        STYLE_HINTS.put("甜", "甜美日常");
        STYLE_HINTS.put("酷", "高冷御姐");
        STYLE_HINTS.put("商务", "都市商务");
    }

    public MockNluProvider(AiAvatarStorage storage, ObjectMapper mapper) {
        super(AiAvatarCapability.NLU, AiAvatarProviderMode.MOCK, "MOCK", storage, mapper);
    }

    @Override
    public ProviderResult run(JsonNode input, AiAvatarJobContext ctx) {
        String prompt = strVal(input, "prompt", "");
        step(ctx, 30, "理解人设描述", 180);
        step(ctx, 75, "抽取结构化字段", 220);

        String style = "现代时尚";
        for (Map.Entry<String, String> e : STYLE_HINTS.entrySet()) {
            if (prompt.contains(e.getKey())) { style = e.getValue(); break; }
        }

        ObjectNode r = mapper.createObjectNode();
        r.put("appearance", firstSentence(prompt, "清爽五官、辨识度高"));
        r.put("temperament", prompt.contains("冷") ? "高冷疏离" : "亲和自然");
        r.put("style", style);
        r.put("scene", prompt.contains("舞台") ? "舞台主视觉" : "商业代言 / 内容连载");
        ArrayNode kws = r.putArray("keywords");
        for (String kw : extractKeywords(prompt)) kws.add(kw);
        r.put("summary", "围绕「" + style + "」定位的虚拟形象，适合长期 IP 运营。");
        r.put("engine", "MOCK");
        step(ctx, 95, "完成", 80);
        return ProviderResult.meta(r.toString());
    }

    private String firstSentence(String s, String def) {
        if (s == null || s.isBlank()) return def;
        String[] parts = s.split("[。.\n,，]");
        return parts.length > 0 && !parts[0].isBlank() ? parts[0].trim() : def;
    }

    private java.util.List<String> extractKeywords(String s) {
        java.util.List<String> out = new java.util.ArrayList<>();
        for (String kw : new String[]{"未来感", "高辨识度", "舞台", "商业", "冷感", "通透", "机能", "国风", "甜美", "御姐"}) {
            if (s.contains(kw.substring(0, Math.min(2, kw.length())))) out.add(kw);
        }
        if (out.isEmpty()) { out.add("高辨识度"); out.add("商业化"); }
        return out;
    }
}
