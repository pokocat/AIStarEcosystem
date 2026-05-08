package com.aistareco.aep.service;

import com.aistareco.aep.dto.EngineRequestBodyDto;
import com.aistareco.aep.model.TemplateScript;
import com.aistareco.aep.model.TemplateScriptKind;
import com.aistareco.aep.model.TemplateScriptStatus;
import com.aistareco.aep.repository.TemplateScriptRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 模板脚本装配服务（v0.5 §3.2.7 §D7）。
 *
 * 入参：scriptId | templateId（取 published），加 product / starId / durationSec / engine / 变量
 * 出参：EngineRequestBody（positive / negative / params + 可选 videoReference）
 *
 * 装配流程：
 *   1) 取 PUBLISHED TemplateScript（按 templateId 取 version 最大者；如指定 scriptId 直取）
 *   2) kind=text：按 durationVariants[durationSec].sceneIds 选场景子集 → 替换 {{var}}
 *      → 拼接 systemPrompt + scenes.positivePromptFragment[*] → 走 engineAdapters[engine].promptTemplate
 *      → 注入 engine.params
 *      kind=video_ref：跳过 scene 子集；把 product/star/variables 灌入 systemPrompt；引擎请求体里
 *      额外注入 referenceClip URL + usage + influence
 *   3) 风控：required var 缺失 / forbiddenWords 命中 / requiredDisclaimers 缺失 → 400
 *   4) 返回 EngineRequestBodyDto
 */
@Service
public class PromptAssemblyService {

    private static final ObjectMapper OM = new ObjectMapper();
    /** {{ key }} | {{ key|"default" }} | {{ arr[0] }}  —— 先匹配 key 主体，default 在替换时单独处理。 */
    private static final Pattern VAR_PAT = Pattern.compile("\\{\\{\\s*([\\w\\.\\[\\]]+)\\s*(?:\\|\\s*\"([^\"]*)\")?\\s*}}");

    private final TemplateScriptRepository repo;

    public PromptAssemblyService(TemplateScriptRepository repo) {
        this.repo = repo;
    }

    /**
     * 按 templateId 装配（取最新 PUBLISHED）。
     * 若该 templateId 无 published TemplateScript，抛 404 SCRIPT_NOT_FOUND。
     */
    public AssemblyResult assembleForTemplate(String templateId, String engine, int durationSec,
                                               Map<String, Object> product, String starId,
                                               Map<String, Object> manualVariables) {
        TemplateScript script = repo
                .findTopByTemplateIdAndStatusOrderByVersionDesc(templateId, TemplateScriptStatus.PUBLISHED)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SCRIPT_NOT_FOUND",
                        "模板 " + templateId + " 没有 published 脚本"));
        return doAssemble(script, engine, durationSec, product, starId, manualVariables);
    }

    /**
     * 按 scriptId 直接装配（dry-run 用，可对 draft 也试跑）。
     */
    public AssemblyResult assembleForScript(String scriptId, String engine, int durationSec,
                                             Map<String, Object> product, String starId,
                                             Map<String, Object> manualVariables) {
        TemplateScript script = repo.findById(scriptId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "SCRIPT_NOT_FOUND",
                        "脚本 " + scriptId + " 不存在"));
        return doAssemble(script, engine, durationSec, product, starId, manualVariables);
    }

    // ── 核心装配 ───────────────────────────────────────────────────────────

    private AssemblyResult doAssemble(TemplateScript script, String engine, int durationSec,
                                       Map<String, Object> product, String starId,
                                       Map<String, Object> manualVariables) {
        if (engine == null || engine.isBlank()) engine = "HiGen";

        Map<String, Object> persona = readObj(script.getPersonaJson());
        List<Map<String, Object>> allScenes = readArr(script.getScenesJson());
        Map<String, Object> visualStyle = readObj(script.getVisualStyleJson());
        List<Map<String, Object>> variables = readArr(script.getVariablesJson());
        Map<String, Object> engineAdapters = readObj(script.getEngineAdaptersJson());
        Map<String, Object> durationVariants = readObj(script.getDurationVariantsJson());
        Map<String, Object> safety = readObj(script.getSafetyJson());
        Map<String, Object> referenceClip = readObj(script.getReferenceClipJson());

        // 1) 装配变量值
        Map<String, Object> bag = new HashMap<>();
        bag.put("starId", starId == null ? "" : starId);
        bag.put("starName", starId == null ? "" : starId);
        bag.put("durationSec", durationSec);
        bag.put("engineName", engine);
        if (product != null) {
            bag.put("productName", product.getOrDefault("name", ""));
            bag.put("productLink", product.getOrDefault("link", ""));
            bag.put("productImages", product.getOrDefault("images", List.of()));
            // sellingPoints：support both String "A;B;C" 与 List 两种
            Object sp = product.get("sellingPoints");
            if (sp instanceof List<?>) bag.put("sellingPoints", sp);
            else if (sp instanceof String s) bag.put("sellingPoints", Arrays.asList(s.split("[;；,，]")));
            else bag.put("sellingPoints", List.of());
        }
        if (manualVariables != null) bag.putAll(manualVariables);

        // 2) 风控：required var 缺失
        List<String> warnings = new ArrayList<>();
        if (variables != null) {
            for (Map<String, Object> v : variables) {
                Boolean req = (Boolean) v.get("required");
                if (req != null && req) {
                    String key = (String) v.get("key");
                    Object val = bag.get(key);
                    if (val == null || (val instanceof String s && s.isBlank())
                            || (val instanceof Collection<?> c && c.isEmpty())) {
                        // default 兜底
                        String def = (String) v.get("default");
                        if (def == null || def.isBlank()) {
                            throw new BusinessException(HttpStatus.BAD_REQUEST, "VAR_REQUIRED_MISSING",
                                    "必填变量缺失：" + key);
                        }
                        bag.put(key, def);
                    }
                }
            }
        }

        // 3) 选 scenes 子集（仅 text 模式）
        List<Map<String, Object>> selectedScenes;
        if (script.getKind() == TemplateScriptKind.TEXT) {
            String key = String.valueOf(durationSec);
            Map<String, Object> dv = durationVariants != null
                    ? (Map<String, Object>) durationVariants.get(key)
                    : null;
            if (dv != null && dv.get("sceneIds") instanceof List<?> ids && !ids.isEmpty()) {
                Set<String> idSet = ids.stream().map(String::valueOf).collect(java.util.stream.Collectors.toSet());
                selectedScenes = (allScenes == null ? List.<Map<String, Object>>of() : allScenes).stream()
                        .filter(s -> idSet.contains(String.valueOf(s.get("id"))))
                        .toList();
            } else {
                selectedScenes = allScenes == null ? List.of() : allScenes;
                warnings.add("durationVariants[" + key + "] 未配置；fallback 使用全部 scenes");
            }
        } else {
            selectedScenes = List.of(); // video_ref 不需要 scene
        }

        // 4) 构造 positive
        StringBuilder positive = new StringBuilder();
        if (persona != null) {
            positive.append("【角色画像】 voiceTone=").append(persona.getOrDefault("voiceTone", ""))
                    .append("; speakingStyle=").append(persona.getOrDefault("speakingStyle", ""))
                    .append("; personality=").append(persona.getOrDefault("personality", ""))
                    .append("\n");
        }
        positive.append(replaceVars(script.getSystemPrompt(), bag, warnings));
        for (Map<String, Object> scene : selectedScenes) {
            positive.append("\n[scene ").append(scene.get("order")).append("] ");
            positive.append("shotType=").append(scene.getOrDefault("shotType", "")).append("; ");
            positive.append("setting=").append(scene.getOrDefault("setting", "")).append("; ");
            positive.append("action=").append(replaceVars(asString(scene.get("action")), bag, warnings)).append("; ");
            positive.append("dialogue=").append(replaceVars(asString(scene.get("dialogue")), bag, warnings)).append("; ");
            positive.append("prompt=").append(replaceVars(asString(scene.get("positivePromptFragment")), bag, warnings));
        }
        if (visualStyle != null) {
            positive.append("\n【风格】 lighting=").append(visualStyle.getOrDefault("lighting", ""))
                    .append("; cinematography=").append(visualStyle.getOrDefault("cinematography", ""));
        }

        // 5) 构造 negative
        StringBuilder negative = new StringBuilder();
        if (script.getNegativePrompt() != null) negative.append(script.getNegativePrompt());
        for (Map<String, Object> scene : selectedScenes) {
            String np = asString(scene.get("negativePromptFragment"));
            if (!np.isBlank()) negative.append("; ").append(np);
        }
        if (safety != null) {
            Object fw = safety.get("forbiddenWords");
            if (fw instanceof List<?> l && !l.isEmpty()) {
                negative.append("; 禁止包含：").append(String.join(", ",
                        l.stream().map(String::valueOf).toList()));
                // 风控：positive 命中 forbiddenWords
                String posLower = positive.toString().toLowerCase();
                for (Object w : l) {
                    String word = String.valueOf(w).toLowerCase();
                    if (!word.isBlank() && posLower.contains(word)) {
                        throw new BusinessException(HttpStatus.BAD_REQUEST, "FORBIDDEN_WORD",
                                "装配后的 prompt 命中禁词：" + word);
                    }
                }
            }
            // requiredDisclaimers：positive 必须包含
            Object rd = safety.get("requiredDisclaimers");
            if (rd instanceof List<?> l) {
                for (Object d : l) {
                    String disc = String.valueOf(d);
                    if (!disc.isBlank() && !positive.toString().contains(disc)) {
                        throw new BusinessException(HttpStatus.BAD_REQUEST, "REQUIRED_DISCLAIMER_MISSING",
                                "装配后的 prompt 缺必备声明：" + disc);
                    }
                }
            }
        }

        // 6) engine adapter
        Map<String, Object> adapter = engineAdapters != null
                ? (Map<String, Object>) engineAdapters.get(engine)
                : null;
        if (adapter == null) {
            warnings.add("engine " + engine + " 未配置 adapter；fallback 使用默认参数");
            adapter = Map.of("enabled", true, "params", Map.of());
        }
        Boolean adapterEnabled = (Boolean) adapter.get("enabled");
        if (adapterEnabled != null && !adapterEnabled) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "ENGINE_DISABLED",
                    "脚本未为引擎 " + engine + " 启用 adapter");
        }

        // adapter.promptTemplate 二次包装（如 "{{systemPrompt}} 加 X"）
        String tpl = (String) adapter.get("promptTemplate");
        String finalPositive = (tpl != null && !tpl.isBlank())
                ? replaceVars(tpl
                        .replace("{{systemPrompt}}", positive.toString())
                        .replace("{{scenes}}", ""), bag, warnings)
                : positive.toString();

        Map<String, Object> params = adapter.get("params") instanceof Map<?, ?> p
                ? new HashMap<>((Map<String, Object>) p)
                : new HashMap<>();
        String fallbackEngine = (String) adapter.get("fallbackEngine");

        // 7) video_ref：注入参考视频通道
        Map<String, Object> videoRef = null;
        if (script.getKind() == TemplateScriptKind.VIDEO_REF) {
            if (referenceClip == null || referenceClip.isEmpty()) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "REFERENCE_CLIP_MISSING",
                        "video_ref 模式必须配置 referenceClip");
            }
            String reviewStatus = String.valueOf(referenceClip.getOrDefault("reviewStatus", "pending"));
            if (!"approved".equals(reviewStatus)) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "REFERENCE_CLIP_NOT_APPROVED",
                        "参考视频未审核通过（reviewStatus=" + reviewStatus + "）");
            }
            videoRef = new LinkedHashMap<>();
            videoRef.put("url", referenceClip.get("videoUrl"));
            videoRef.put("usage", referenceClip.getOrDefault("usage", "all"));
            videoRef.put("influence", referenceClip.getOrDefault("influence", 0.5));
            if (referenceClip.get("segments") != null) videoRef.put("segments", referenceClip.get("segments"));
        }

        EngineRequestBodyDto body = new EngineRequestBodyDto(
                engine, finalPositive, negative.toString(), params, videoRef, fallbackEngine);
        return new AssemblyResult(script.getId(), script.getVersion(), body, warnings);
    }

    // ── 内部 ───────────────────────────────────────────────────────────────

    private static String replaceVars(String template, Map<String, Object> bag, List<String> warnings) {
        if (template == null || template.isBlank()) return "";
        Matcher m = VAR_PAT.matcher(template);
        StringBuffer out = new StringBuffer();
        while (m.find()) {
            String key = m.group(1);
            String def = m.group(2);
            String value = lookup(key, bag);
            if (value == null) {
                if (def != null) {
                    value = def;
                } else {
                    warnings.add("变量未替换：{{" + key + "}}");
                    value = "";
                }
            }
            m.appendReplacement(out, Matcher.quoteReplacement(value));
        }
        m.appendTail(out);
        return out.toString();
    }

    /** 支持 key 与 key[index] 两种形式；不支持嵌套对象（v0.5 范围）。 */
    private static String lookup(String key, Map<String, Object> bag) {
        Matcher idx = Pattern.compile("^([\\w\\.]+)\\[(\\d+)]$").matcher(key);
        if (idx.matches()) {
            String base = idx.group(1);
            int i = Integer.parseInt(idx.group(2));
            Object val = bag.get(base);
            if (val instanceof List<?> l && i >= 0 && i < l.size()) return String.valueOf(l.get(i));
            return null;
        }
        Object val = bag.get(key);
        return val == null ? null : (val instanceof List<?> l ? String.join(" / ", l.stream().map(String::valueOf).toList()) : String.valueOf(val));
    }

    private static String asString(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    private static Map<String, Object> readObj(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return OM.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }

    private static List<Map<String, Object>> readArr(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return OM.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return null;
        }
    }

    /** 内部装配结果包装。 */
    public record AssemblyResult(String scriptId, Integer scriptVersion,
                                  EngineRequestBodyDto request, List<String> warnings) {}
}
