package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.repository.IpDemoTemplateRepository;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 把一个真实项目存成**全局示例工作流**（v0.182）。
 *
 * <p>为什么不能直接把项目文档当模板用：文档里的素材键是
 * {@code ipstudio/source/<uid>/…} / {@code ipstudio/gen/<uid>/…} —— 带着作者的 uid。
 * 别人打开时归属闸（{@link IpProjectService#ownsAssetKey}）会正确地拒绝，画布一片空白；
 * 就算放行也不该放行 —— 那等于让任何人凭一个 key 读别人的素材。
 *
 * <p>所以存示例时把**素材复制一份**到平台自有的 {@code ipstudio/demo/<demoId>/…}，
 * 再把文档里的键换成新键。示例素材是平台内容，所有人可读、没有人可写
 * （写入路径的 key 一律由调用者的 uid 拼出来，落不到这个前缀下）。
 *
 * <p>复制而不是引用，还顺带解决两件事：作者删账号 / 删项目，示例不受影响；
 * 作者继续改他自己的项目，示例也不会跟着变。
 */
@Service
public class IpDemoTemplateService {

    private static final Logger log = LoggerFactory.getLogger(IpDemoTemplateService.class);

    /** 示例素材分类。平台自有，所有人可读。 */
    public static final String CATEGORY_DEMO = "ipstudio/demo";
    /** 一个示例最多复制多少个素材 —— 挡住把一个几百节点的项目整个搬进示例。 */
    private static final int MAX_ASSETS = 60;

    private final IpDemoTemplateRepository repo;
    private final IpProjectService projects;
    private final FileStorageService storage;
    private final ObjectMapper om;

    public IpDemoTemplateService(IpDemoTemplateRepository repo,
                                 IpProjectService projects,
                                 FileStorageService storage,
                                 ObjectMapper om) {
        this.repo = repo;
        this.projects = projects;
        this.storage = storage;
        this.om = om;
    }

    public List<IpDemoTemplate> listEnabled() {
        return repo.findByEnabledTrueOrderBySortOrderAscCreatedAtAsc();
    }

    /** 示例文档 → JSON 树；坏了就当空画布（示例坏掉不该让整个目录打不开）。 */
    public JsonNode docOf(IpDemoTemplate row) {
        try {
            JsonNode n = om.readTree(row.getDocJson());
            return n != null && n.isObject() ? n : IpDocs.emptyDoc(om);
        } catch (Exception e) {
            log.warn("[ipstudio] 示例文档解析失败 demo={}: {}", row.getId(), e.getMessage());
            return IpDocs.emptyDoc(om);
        }
    }

    /**
     * 从项目建 / 更新一个示例。{@code demoId} 传已有 id 就是更新（素材重新复制一份，旧的留着不删 ——
     * 万一新的一版有问题，回滚只要把 doc 换回去）。
     */
    @Transactional
    public IpDemoTemplate publishFromProject(String operatorId, String projectId,
                                             String demoId, String name, String summary) {
        // 只能拿**自己的**项目做示例：运营也不该凭一个 id 就把别人的画布连素材抄成公开内容。
        IpProject p = projects.required(operatorId, projectId);
        JsonNode doc = projects.readDoc(p);

        String id = demoId != null && !demoId.isBlank() ? demoId.trim() : "IPD-" + IpProjectService.hex8();
        Map<String, String> remap = new HashMap<>();
        String cover = null;
        int copied = 0;

        for (JsonNode node : IpDocs.nodes(doc)) {
            JsonNode md = IpDocs.metadataOf(node);
            if (!(md instanceof ObjectNode mo)) continue;
            String newKey = copyKey(id, IpDocs.text(mo, "storageKey"), remap);
            if (newKey != null) {
                mo.put("storageKey", newKey);
                copied++;
                if (cover == null && IpDocs.T_IMAGE.equals(IpDocs.typeOf(node))) cover = newKey;
            }
            JsonNode images = mo.path("images");
            if (images.isArray()) {
                for (JsonNode img : images) {
                    if (!(img instanceof ObjectNode io)) continue;
                    String k = copyKey(id, IpDocs.text(io, "storageKey"), remap);
                    if (k != null) { io.put("storageKey", k); copied++; }
                }
            }
            // 派生地址不进示例：它们是当次签的、带 TTL（§4.7.7）。真值是 storageKey，
            // 用户打开示例时按 key 现签。
            mo.remove("content");
            mo.remove("url");
            if (images.isArray()) {
                for (JsonNode img : images) if (img instanceof ObjectNode io) io.remove("content");
            }
        }
        if (copied > MAX_ASSETS) {
            throw BusinessException.badRequest("IP_DEMO_TOO_MANY_ASSETS",
                    "这个项目的素材太多（" + copied + " 个），做示例请先精简到 " + MAX_ASSETS + " 个以内");
        }

        IpDemoTemplate row = repo.findById(id).orElseGet(() -> IpDemoTemplate.builder()
                .id(id).enabled(true).sortOrder(0).createdAt(Instant.now()).build());
        row.setName(name != null && !name.isBlank() ? name.trim()
                : (p.getName() == null || p.getName().isBlank() ? "示例 IP 工作流" : p.getName()));
        row.setSummary(summary);
        row.setDocJson(write(doc));
        if (cover != null) row.setCoverKey(cover);
        row.setSourceProjectId(projectId);
        row.setCreatedBy(operatorId);
        row.setUpdatedAt(Instant.now());
        repo.save(row);
        log.info("[ipstudio] 存为全局示例 demo={} source={} assets={}", id, projectId, copied);
        return row;
    }

    @Transactional
    public void setEnabled(String demoId, boolean enabled) {
        IpDemoTemplate row = repo.findById(demoId)
                .orElseThrow(() -> BusinessException.notFound("IP_DEMO_NOT_FOUND", "示例不存在"));
        row.setEnabled(enabled);
        row.setUpdatedAt(Instant.now());
        repo.save(row);
    }

    /** 把一个素材复制进示例目录，返回新 key；同一个 key 只复制一次。读不出来返回 null（跳过那一张）。 */
    private String copyKey(String demoId, String key, Map<String, String> remap) {
        if (key == null || key.isBlank()) return null;
        String hit = remap.get(key);
        if (hit != null) return hit;
        try {
            Path src = storage.openForRead(key);
            byte[] bytes = Files.readAllBytes(src);
            String ext = extOf(key);
            FileStorageService.StoredFile stored =
                    storage.store(bytes, CATEGORY_DEMO, demoId, ext, contentTypeOf(ext));
            remap.put(key, stored.key());
            return stored.key();
        } catch (Exception e) {
            // 读不出来的那一张跳过 —— 示例少一张图，比整个「存为示例」失败强
            log.warn("[ipstudio] 示例素材复制失败 demo={} key={}: {}", demoId, key, e.getMessage());
            return null;
        }
    }

    private static String extOf(String key) {
        int dot = key.lastIndexOf('.');
        if (dot < 0 || dot == key.length() - 1) return "png";
        String e = key.substring(dot + 1).toLowerCase();
        return e.matches("[a-z0-9]{1,5}") ? e : "png";
    }

    private static String contentTypeOf(String ext) {
        return switch (ext) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "webp" -> "image/webp";
            case "mp4" -> "video/mp4";
            case "mp3" -> "audio/mpeg";
            default -> "image/png";
        };
    }

    private String write(JsonNode doc) {
        try {
            return om.writeValueAsString(doc);
        } catch (Exception e) {
            throw BusinessException.badRequest("IP_DOC_INVALID", "画布数据无法序列化");
        }
    }
}
