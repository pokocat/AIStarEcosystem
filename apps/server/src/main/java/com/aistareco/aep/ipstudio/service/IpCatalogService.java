package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpStylePresetDto;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpTemplateDto;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * 内置工作流模板与风格预设 —— 从 {@code resources/ipstudio/} 读，进程内缓存一次。
 *
 * <p>为什么不落库：模板是「产品内容」而不是「用户数据」，跟着代码一起发布才不会出现
 * 「新版前端节点类型 + 旧版库里模板」的错配；运营要改就改 JSON 发一版。
 *
 * <p>模板文件缺失 / 解析失败 = 目录里少一条，不抛异常（画布本身仍可用「空白项目」进入）；
 * 但会 WARN，因为这是打包事故而不是正常状态。
 */
@Service
public class IpCatalogService {

    private static final Logger log = LoggerFactory.getLogger(IpCatalogService.class);

    private static final String STYLES_RESOURCE = "ipstudio/styles.json";
    /** 模板文件清单（ClassPathResource 不能列目录，故显式登记；新增模板同时加一行）。 */
    private static final List<String> TEMPLATE_RESOURCES = List.of(
            "ipstudio/templates/portrait-bjd-trio.json",
            "ipstudio/templates/portrait-sticker-six.json");

    private final ObjectMapper om;

    private volatile List<IpTemplateDto> templates;
    private volatile List<IpStylePresetDto> styles;
    private volatile Map<String, IpStylePresetDto> styleById;

    public IpCatalogService(ObjectMapper om) {
        this.om = om;
    }

    public List<IpTemplateDto> templates() {
        if (templates == null) {
            synchronized (this) {
                if (templates == null) templates = loadTemplates();
            }
        }
        return templates;
    }

    public Optional<IpTemplateDto> template(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        return templates().stream().filter(t -> id.equals(t.id())).findFirst();
    }

    public List<IpStylePresetDto> styles() {
        ensureStyles();
        return styles;
    }

    public Optional<IpStylePresetDto> style(String id) {
        if (id == null || id.isBlank()) return Optional.empty();
        ensureStyles();
        return Optional.ofNullable(styleById.get(id));
    }

    private void ensureStyles() {
        if (styles == null) {
            synchronized (this) {
                if (styles == null) {
                    List<IpStylePresetDto> loaded = loadStyles();
                    Map<String, IpStylePresetDto> byId = new LinkedHashMap<>();
                    loaded.forEach(s -> byId.put(s.id(), s));
                    styleById = byId;
                    styles = loaded;
                }
            }
        }
    }

    private List<IpTemplateDto> loadTemplates() {
        List<IpTemplateDto> out = new ArrayList<>();
        for (String path : TEMPLATE_RESOURCES) {
            JsonNode n = readJson(path);
            if (n == null || !n.isObject()) continue;
            String id = n.path("id").asText(null);
            if (id == null || id.isBlank()) {
                log.warn("[ipstudio] 模板缺 id，跳过 resource={}", path);
                continue;
            }
            JsonNode doc = n.path("doc");
            out.add(new IpTemplateDto(
                    id,
                    n.path("name").asText(id),
                    n.path("summary").asText(""),
                    n.path("coverUrl").isTextual() ? n.path("coverUrl").asText() : null,
                    n.path("stylePresetId").isTextual() ? n.path("stylePresetId").asText() : null,
                    n.path("lookCount").asInt(0),
                    n.path("estimatedCredits").asLong(0),
                    doc.isObject() ? doc : om.createObjectNode()));
        }
        log.info("[ipstudio] 内置模板加载 {} 条", out.size());
        return List.copyOf(out);
    }

    private List<IpStylePresetDto> loadStyles() {
        JsonNode root = readJson(STYLES_RESOURCE);
        List<IpStylePresetDto> out = new ArrayList<>();
        JsonNode arr = root == null ? null : (root.isArray() ? root : root.path("styles"));
        if (arr != null && arr.isArray()) {
            for (JsonNode n : arr) {
                String id = n.path("id").asText(null);
                if (id == null || id.isBlank()) continue;
                out.add(new IpStylePresetDto(
                        id,
                        n.path("name").asText(id),
                        n.path("summary").asText(""),
                        n.path("promptEn").asText(""),
                        n.path("negativeEn").isTextual() ? n.path("negativeEn").asText() : null,
                        n.path("coverUrl").isTextual() ? n.path("coverUrl").asText() : null));
            }
        }
        log.info("[ipstudio] 内置风格加载 {} 套", out.size());
        return List.copyOf(out);
    }

    private JsonNode readJson(String path) {
        try (InputStream in = new ClassPathResource(path).getInputStream()) {
            return om.readTree(in);
        } catch (Exception e) {
            log.warn("[ipstudio] 读取资源失败 resource={}: {}", path, e.getMessage());
            return null;
        }
    }
}
