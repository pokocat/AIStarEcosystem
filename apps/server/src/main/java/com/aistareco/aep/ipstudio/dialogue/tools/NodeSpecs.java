package com.aistareco.aep.ipstudio.dialogue.tools;

import com.aistareco.aep.ipstudio.service.IpDocs;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.*;

/**
 * The structured settings the assistant writes on an image / video draft node ({@code metadata.studio.spec}): aspect
 * ratio, duration, count and which canvas material is used as what. The composer opens with exactly these values and the
 * request is built from them, so 「16:9、4 秒、男女主三视图 + 客厅图」 said in the conversation is what gets quoted and
 * submitted. Before this the assistant could only write prose into the prompt; the node kept its defaults (9:16, 8 s,
 * one connected image) and that is what was sent (IPR-fde32da6c2cc4664974f, 2026-10-20).
 *
 * <p>Whether the chosen model supports a value is decided at the composer with the real model contract: an unsupported
 * value is shown as a blocking message, never silently replaced. This class only checks shape.
 */
final class NodeSpecs {
    static final Set<String> RATIOS = Set.of("9:16", "16:9", "1:1", "3:4", "4:3", "2:3", "3:2", "21:9");
    static final Set<String> ROLES = Set.of("character", "scene", "product", "frame", "style");
    static final int MAX_REFERENCES = 8;
    private NodeSpecs() {}

    /** JSON-schema properties for the spec fields, added to a node item of create_nodes / update_nodes. */
    static void describe(ObjectNode properties) {
        properties.putObject("aspectRatio").put("type", "string").put("description", "画幅，用户说了就照写：" + String.join(" / ", new TreeSet<>(RATIOS)));
        properties.putObject("durationSec").put("type", "integer").put("description", "视频时长（秒），用户说了就照写");
        properties.putObject("count").put("type", "integer").put("description", "生成几张 / 几条：1、2 或 4");
        var refs = properties.putObject("references").put("type", "array")
                .put("description", "这个对象要用的全部参考素材（已有画面的图片 / 视频），按用途标 role：character 人物、scene 场景、product 商品、frame 首帧（两张 frame 依次是首帧、尾帧）、style 风格。"
                        + "这是完整清单：写了就替换原来连着的素材（换成别的人就只写新的那张，[] 表示不用参考）；不写就保持不变。会连线到这个对象，生成时一起提交");
        var item = refs.putObject("items").put("type", "object");
        item.putObject("properties").putObject("nodeId").put("type", "string");
        ((ObjectNode) item.path("properties")).putObject("role").put("type", "string").putArray("enum").add("character").add("scene").add("product").add("frame").add("style");
        item.putArray("required").add("nodeId").add("role");
    }

    /**
     * Shape check for one node item; {@code type} is the node's media type. {@code siblings} are temp keys created in the
     * same call (they have no picture yet, so they cannot be references). Null when valid.
     */
    static String validate(JsonNode n, String type, JsonNode doc, Set<String> siblings) {
        boolean video = "video".equals(type), image = "image".equals(type);
        boolean any = n.has("aspectRatio") || n.has("durationSec") || n.has("count") || n.has("references");
        if (!any) return null;
        if (!video && !image) return "画幅、时长、数量和参考素材只能写在图片或视频对象上";
        if (n.has("aspectRatio") && !RATIOS.contains(n.path("aspectRatio").asText(""))) return "画幅只能是 " + String.join("、", new TreeSet<>(RATIOS));
        if (n.has("durationSec")) {
            if (!video) return "只有视频对象有时长";
            if (!n.path("durationSec").isIntegralNumber() || !n.path("durationSec").canConvertToInt() || n.path("durationSec").asInt() < 1 || n.path("durationSec").asInt() > 60) return "视频时长写 1 到 60 之间的整数秒";
        }
        if (n.has("count") && (!n.path("count").isIntegralNumber() || !Set.of(1, 2, 4).contains(n.path("count").asInt(-1)))) return "数量只能是 1、2 或 4";
        JsonNode refs = n.path("references");
        if (n.has("references")) {
            if (!refs.isArray() || refs.size() > MAX_REFERENCES) return "参考素材最多 " + MAX_REFERENCES + " 份";
            Set<String> seen = new HashSet<>();
            if (refs.findValuesAsText("role").stream().filter("frame"::equals).count() > 2) return "首帧 / 尾帧最多两张";
            for (JsonNode r : refs) {
                String id = DialogueTools.text(r, "nodeId"), role = DialogueTools.text(r, "role");
                if (id == null || !seen.add(id)) return "参考素材需要不重复的 nodeId";
                if (!ROLES.contains(String.valueOf(role))) return "参考用途只能是 character、scene、product、frame、style";
                if (siblings.contains(id)) return "刚新建的对象还没有画面，不能当参考素材";
                JsonNode ref = IpDocs.node(doc, id);
                if (ref == null) return "参考素材 " + id + " 不在画布上（编号要照素材清单原样填写）";
                if (!Set.of("image", "video").contains(ref.path("type").asText()) || IpDocs.primaryStorageKey(ref) == null)
                    return "「" + ref.path("title").asText() + "」还没有画面，不能当参考素材";
            }
        }
        return null;
    }

    /** {@code metadata.studio.spec} for the node, or null when the item names no spec field. */
    static ObjectNode spec(JsonNode n, ObjectMapper om) {
        if (!(n.has("aspectRatio") || n.has("durationSec") || n.has("count") || n.has("references"))) return null;
        ObjectNode spec = om.createObjectNode();
        if (n.has("aspectRatio")) spec.put("aspectRatio", n.path("aspectRatio").asText());
        if (n.has("durationSec")) spec.put("durationSec", n.path("durationSec").asInt());
        if (n.has("count")) spec.put("count", n.path("count").asInt());
        if (n.has("references")) {
            var refs = spec.putArray("references");
            for (JsonNode r : n.path("references")) refs.addObject().put("nodeId", DialogueTools.text(r, "nodeId")).put("role", DialogueTools.text(r, "role"));
        }
        spec.put("source", "assistant").put("updatedAt", Instant.now().toString());
        return spec;
    }

    /** Short user-facing description of a spec for the work record and the model. */
    static String summary(ObjectNode spec) {
        if (spec == null) return "";
        List<String> parts = new ArrayList<>();
        if (spec.has("aspectRatio")) parts.add(spec.path("aspectRatio").asText());
        if (spec.has("durationSec")) parts.add(spec.path("durationSec").asInt() + " 秒");
        if (spec.has("count")) parts.add(spec.path("count").asInt() + " 份");
        if (spec.path("references").size() > 0) parts.add(spec.path("references").size() + " 份参考素材");
        return String.join("、", parts);
    }
}
