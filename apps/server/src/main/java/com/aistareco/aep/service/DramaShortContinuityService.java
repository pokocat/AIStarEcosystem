package com.aistareco.aep.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * 风格短片的一致性真值与零 token 质检。
 *
 * <p>Manifest 不交给大模型重复编写：脚本模型只负责创作，服务端在同一次响应后按稳定规则派生
 * 角色、场景、镜头依赖与音频时间线。这样既没有第二次 token 消耗，也不会出现模型自造 id、
 * 漏依赖或把台词混进视觉提示词的漂移。</p>
 */
@Service
public class DramaShortContinuityService {
    public static final String MANIFEST_VERSION = "1.0";
    public static final String PROMPT_VERSION = "drama-short-v2";
    public static final String ASSEMBLY_VERSION = "drama-short-av-v1";

    private final ObjectMapper om;

    public DramaShortContinuityService(ObjectMapper om) {
        this.om = om;
    }

    /** AI 脚本响应使用：保留创作内容，只补稳定 id 与派生 manifest。 */
    public ObjectNode enrichScript(ObjectNode script) {
        ObjectNode manifest = baseManifest();
        ObjectNode meta = object(script.path("meta"));
        ObjectNode character = object(meta.path("character"));
        String characterName = clean(character.path("name").asText(""));

        ArrayNode characters = manifest.putArray("characters");
        ObjectNode ch = characters.addObject();
        ch.put("id", "character-main");
        ch.put("name", characterName);
        ch.put("visualTraits", characterName);
        ch.put("performanceTraits", clean(character.path("description").asText("")));

        ArrayNode scenesOut = manifest.putArray("scenes");
        ArrayNode shotsOut = manifest.putArray("shots");
        Map<String, String> sceneIds = new LinkedHashMap<>();
        JsonNode scenes = script.path("scenes");
        String previousShotId = null;
        int timelineSec = 0;
        int no = 0;
        for (JsonNode raw : scenes) {
            if (!(raw instanceof ObjectNode scene)) continue;
            no++;
            String shotId = stableId("shot", no);
            String heading = clean(scene.path("heading").asText(""));
            String sceneKey = heading.isBlank() ? clean(meta.path("scene").asText("")) : heading;
            String sceneId = sceneIds.computeIfAbsent(sceneKey, ignored -> stableId("scene", sceneIds.size() + 1));
            if (sceneIds.get(sceneKey).equals(sceneId)
                    && !containsId(scenesOut, sceneId)) {
                ObjectNode target = scenesOut.addObject();
                target.put("id", sceneId);
                target.put("name", heading.isBlank() ? "主场景" : heading);
                target.put("visualTraits", heading.isBlank() ? clean(meta.path("scene").asText("")) : heading);
            }
            scene.put("id", shotId);
            scene.put("scene_id", sceneId);
            ObjectNode shot = shotsOut.addObject();
            shot.put("id", shotId);
            shot.put("no", no);
            shot.put("sceneId", sceneId);
            int durationSec = Math.max(1, scene.path("duration_sec").asInt(4));
            shot.put("durationSec", durationSec);
            shot.put("continuityMode", previousShotId == null ? "anchor" : "chain");
            if (previousShotId != null) shot.put("parentShotId", previousShotId);
            ArrayNode cast = shot.putArray("castIds");
            if (!characterName.isBlank()) cast.add("character-main");
            ObjectNode dialogue = shot.putObject("dialogue");
            dialogue.put("speaker", characterName.isBlank() ? "旁白" : characterName);
            dialogue.put("text", clean(scene.path("dialogue").asText("")));
            ObjectNode audio = shot.putObject("audio");
            audio.put("startSec", timelineSec);
            audio.put("endSec", timelineSec + durationSec);
            audio.put("sfx", clean(scene.path("sfx").asText("")));
            audio.put("bgm", clean(scene.path("bgm").asText("")));
            timelineSec += durationSec;
            previousShotId = shotId;
        }
        manifest.set("dependencyPlan", dependencyPlan(shotsOut));
        script.set("continuity_manifest", manifest);
        return script;
    }

    /** 草稿保存/预检使用：以当前可编辑分镜为准重建，不信任客户端伪造的依赖图。 */
    public ObjectNode ensureDraft(ObjectNode data) {
        ObjectNode manifest = baseManifest();
        ObjectNode meta = object(data.path("meta"));
        ObjectNode character = object(meta.path("character"));
        String characterName = clean(character.path("name").asText(""));
        ObjectNode avatar = object(data.path("characterAvatar"));
        ObjectNode characterRef = object(data.path("characterRef"));
        ObjectNode sceneRef = object(data.path("sceneRef"));

        ObjectNode ch = manifest.putArray("characters").addObject();
        ch.put("id", "character-main");
        ch.put("name", characterName);
        ch.put("visualTraits", characterName);
        ch.put("performanceTraits", clean(character.path("description").asText("")));
        putIfText(ch, "avatarId", avatar.path("id"));
        ObjectNode canonical = ch.putObject("canonicalRef");
        putIfText(canonical, "cdnKey", characterRef.path("cdnKey"));
        String characterUrl = firstText(avatar.path("image"), characterRef.path("url"));
        if (characterUrl != null) canonical.put("url", characterUrl);

        ObjectNode scene = manifest.putArray("scenes").addObject();
        scene.put("id", "scene-main");
        scene.put("name", "主场景");
        scene.put("visualTraits", clean(meta.path("scene").asText("")));
        ObjectNode sceneCanonical = scene.putObject("canonicalRef");
        putIfText(sceneCanonical, "cdnKey", sceneRef.path("cdnKey"));
        putIfText(sceneCanonical, "url", sceneRef.path("url"));

        ArrayNode shotsOut = manifest.putArray("shots");
        JsonNode shots = data.path("shots");
        String previous = null;
        int timelineSec = 0;
        int index = 0;
        if (shots.isArray()) for (JsonNode raw : shots) {
            if (!(raw instanceof ObjectNode source)) continue;
            index++;
            String id = clean(source.path("id").asText(""));
            if (id.isBlank()) {
                id = stableId("shot", index);
                source.put("id", id);
            }
            source.put("sceneId", "scene-main");
            if (previous != null) source.put("parentShotId", previous); else source.remove("parentShotId");
            ObjectNode target = shotsOut.addObject();
            target.put("id", id);
            target.put("no", source.path("no").asInt(index));
            target.put("sceneId", "scene-main");
            int durationSec = Math.max(1, source.path("dur").asInt(4));
            target.put("durationSec", durationSec);
            target.put("continuityMode", previous == null ? "anchor" : "chain");
            if (previous != null) target.put("parentShotId", previous);
            ArrayNode cast = target.putArray("castIds");
            if (!characterName.isBlank() || characterUrl != null) cast.add("character-main");
            ObjectNode dialogue = target.putObject("dialogue");
            dialogue.put("speaker", clean(source.path("voWho").asText("")));
            dialogue.put("text", clean(source.path("voText").asText("")));
            ObjectNode audio = target.putObject("audio");
            audio.put("startSec", timelineSec);
            audio.put("endSec", timelineSec + durationSec);
            audio.put("sfx", clean(source.path("sfx").asText("")));
            audio.put("bgm", clean(source.path("bgm").asText("")));
            audio.put("subtitle", source.path("sub").asBoolean(true));
            timelineSec += durationSec;
            previous = id;
        }
        manifest.set("dependencyPlan", dependencyPlan(shotsOut));
        data.set("continuityManifest", manifest);
        return manifest;
    }

    /** 不调用模型、不提交媒体任务的结构化前置质检。 */
    public ObjectNode preflight(ObjectNode data) {
        ObjectNode manifest = ensureDraft(data);
        ArrayNode issues = om.createArrayNode();
        JsonNode shots = data.path("shots");
        int totalDuration = 0;
        int completed = 0;
        int audioReady = 0;
        Set<String> ids = new LinkedHashSet<>();
        boolean hasDialogue = false;
        if (!shots.isArray() || shots.isEmpty()) {
            issue(issues, "error", "NO_SHOTS", "还没有分镜，请先生成或添加分镜。", null);
        } else for (JsonNode shot : shots) {
            String id = clean(shot.path("id").asText(""));
            int no = shot.path("no").asInt(ids.size() + 1);
            if (!ids.add(id)) issue(issues, "error", "DUPLICATE_SHOT_ID", "分镜 ID 重复，无法建立依赖关系。", no);
            int duration = shot.path("dur").asInt(0);
            totalDuration += Math.max(0, duration);
            if (duration <= 0) issue(issues, "error", "INVALID_DURATION", "分镜时长必须大于 0 秒。", no);
            if (clean(shot.path("visual").asText("")).isBlank())
                issue(issues, "error", "VISUAL_REQUIRED", "请补充本镜纯画面描述。", no);
            String dialogue = clean(shot.path("voText").asText(""));
            hasDialogue |= !dialogue.isBlank();
            if ("done".equals(shot.path("flow").asText("")) && !clean(shot.path("videoUrl").asText("")).isBlank()) completed++;
            JsonNode audio = shot.path("audio");
            if (dialogue.isBlank() || (!clean(audio.path("cdnKey").asText("")).isBlank()
                    && fingerprint(dialogue).equals(audio.path("textFingerprint").asText("")))) audioReady++;
            JsonNode refs = shot.path("appliedRefs");
            if (refs.isObject() && refs.path("requested").asInt(0) > refs.path("applied").asInt(0))
                issue(issues, "warning", "REFS_DROPPED", "上次渲染有参考图未被模型采用，请查看参考明细。", no);
        }
        if (totalDuration <= 0 && shots.isArray() && !shots.isEmpty())
            issue(issues, "error", "TOTAL_DURATION_INVALID", "总时长无效。", null);
        boolean hasCanonicalCharacter = !clean(data.path("characterAvatar").path("id").asText("")).isBlank()
                || !clean(data.path("characterRef").path("cdnKey").asText("")).isBlank();
        if (!hasCanonicalCharacter)
            issue(issues, "warning", "CHARACTER_REFERENCE_RECOMMENDED", "建议绑定数字人或主角参考图，以锁定人物外观。", null);
        if (hasDialogue && clean(data.path("characterAvatar").path("id").asText("")).isBlank())
            issue(issues, "error", "VOICE_SOURCE_REQUIRED", "有台词的短片需绑定一位已关联声音的数字人，才能生成配音。", null);

        boolean structuralReady = !hasError(issues, Set.of("NO_SHOTS", "DUPLICATE_SHOT_ID", "INVALID_DURATION", "VISUAL_REQUIRED", "TOTAL_DURATION_INVALID"));
        boolean audioComplete = shots.isArray() && audioReady == shots.size();
        boolean assemblyReady = shots.isArray() && !shots.isEmpty() && completed == shots.size() && audioComplete;
        ObjectNode out = om.createObjectNode();
        out.put("manifestVersion", MANIFEST_VERSION);
        out.put("promptVersion", PROMPT_VERSION);
        out.put("assemblyVersion", ASSEMBLY_VERSION);
        out.put("totalDurationSec", totalDuration);
        out.put("shotCount", shots.isArray() ? shots.size() : 0);
        out.put("completedShotCount", completed);
        out.put("audioReadyCount", audioReady);
        out.put("structuralReady", structuralReady);
        out.put("audioReady", audioComplete);
        out.put("assemblyReady", assemblyReady);
        out.set("issues", issues);
        out.set("dependencyPlan", manifest.path("dependencyPlan").deepCopy());
        return out;
    }

    public static String fingerprint(String value) {
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            return java.util.HexFormat.of().formatHex(digest.digest(clean(value).getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private ObjectNode baseManifest() {
        ObjectNode out = om.createObjectNode();
        out.put("version", MANIFEST_VERSION);
        out.put("promptVersion", PROMPT_VERSION);
        ObjectNode render = out.putObject("renderSpec");
        render.put("aspectRatio", "9:16");
        render.put("width", 720);
        render.put("height", 1280);
        render.put("fps", 30);
        render.put("visualTextPolicy", "no_text");
        render.put("subtitlePolicy", "platform_exact");
        return out;
    }

    private ArrayNode dependencyPlan(ArrayNode shots) {
        ArrayNode plan = om.createArrayNode();
        Map<String, Integer> depth = new HashMap<>();
        for (JsonNode shot : shots) {
            String id = shot.path("id").asText();
            String parent = shot.path("parentShotId").asText("");
            int batch = parent.isBlank() ? 0 : depth.getOrDefault(parent, 0) + 1;
            depth.put(id, batch);
            ObjectNode row = plan.addObject();
            row.put("shotId", id);
            row.put("batch", batch);
            if (!parent.isBlank()) row.put("dependsOn", parent);
            ArrayNode refs = row.putArray("requiredRefs");
            refs.add("character");
            refs.add("scene");
            if (!parent.isBlank()) refs.add("previous_last_frame");
        }
        return plan;
    }

    private static ObjectNode object(JsonNode node) {
        return node instanceof ObjectNode o ? o : new ObjectMapper().createObjectNode();
    }

    private static boolean containsId(ArrayNode nodes, String id) {
        for (JsonNode node : nodes) if (id.equals(node.path("id").asText())) return true;
        return false;
    }

    private static void putIfText(ObjectNode target, String name, JsonNode source) {
        String value = clean(source == null ? null : source.asText(null));
        if (!value.isBlank()) target.put(name, value);
    }

    private static String firstText(JsonNode... nodes) {
        for (JsonNode node : nodes) {
            String value = clean(node == null ? null : node.asText(null));
            if (!value.isBlank()) return value;
        }
        return null;
    }

    private static String stableId(String prefix, int no) {
        return "%s-%02d".formatted(prefix, no);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }

    private static void issue(ArrayNode issues, String severity, String code, String message, Integer shotNo) {
        ObjectNode issue = issues.addObject();
        issue.put("severity", severity);
        issue.put("code", code);
        issue.put("message", message);
        if (shotNo != null) issue.put("shotNo", shotNo);
    }

    private static boolean hasError(ArrayNode issues, Set<String> codes) {
        for (JsonNode issue : issues) {
            if ("error".equals(issue.path("severity").asText()) && codes.contains(issue.path("code").asText())) return true;
        }
        return false;
    }
}
