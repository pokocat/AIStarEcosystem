package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.dap.model.DapAvatar;
import com.aistareco.aep.dap.model.DapLook;
import com.aistareco.aep.dap.repository.DapLookRepository;
import com.aistareco.aep.dap.service.DapAvatarService;
import com.aistareco.aep.dap.service.DapMultimodalClient;
import com.aistareco.aep.dap.service.DapSupport;
import com.aistareco.aep.ipstudio.dto.IpStudioDtos.IpPublishResultDto;
import com.aistareco.aep.ipstudio.dto.IpStudioRequests.IpPublishRequest;
import com.aistareco.aep.ipstudio.model.IpProject;
import com.aistareco.aep.ipstudio.model.IpRun;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 发布：把画布上选定的主形象与形象卡落成 AiAvatar 数字资产（{@code DapAvatar} + {@code DapLook}）。
 *
 * <p>零积分 —— 图早在 generate 阶段按张扣过了，发布只是登记。
 *
 * <p>不重复上传：主图 / 造型图直接复用 generate 阶段的 storage key（同一个 storage），
 * 复制一份只会让存储用量翻倍。
 */
@Service
public class IpPublishService {

    private static final Logger log = LoggerFactory.getLogger(IpPublishService.class);
    private static final SecureRandom RND = new SecureRandom();

    /** 特征卡中文小标题 → dap def 键（前端资产详情按 dap 的键名渲染）。 */
    private static final Map<String, String> DEF_LABEL_MAP = Map.of(
            "气质", "核心气质",
            "脸型", "脸部特征",
            "五官", "脸部特征",
            "发型发色", "发型妆造",
            "发型", "发型妆造",
            "标志性特征", "标志性特征",
            "肤色", "肤色",
            "年龄段", "年龄");

    private final IpProjectService projects;
    private final DapAvatarService avatars;
    private final DapLookRepository lookRepo;
    private final DapSupport support;
    private final DapMultimodalClient multimodal;

    public IpPublishService(IpProjectService projects,
                            DapAvatarService avatars,
                            DapLookRepository lookRepo,
                            DapSupport support,
                            DapMultimodalClient multimodal) {
        this.projects = projects;
        this.avatars = avatars;
        this.lookRepo = lookRepo;
        this.support = support;
        this.multimodal = multimodal;
    }

    @Transactional
    public IpPublishResultDto publish(String userId, String projectId, IpPublishRequest req) {
        IpProject project = projects.required(userId, projectId);
        if (IpProject.STATUS_PUBLISHED.equals(project.getStatus()) && project.getPublishedAvatarId() != null) {
            throw new BusinessException(HttpStatus.CONFLICT, "IP_PROJECT_ALREADY_PUBLISHED",
                    "该项目已发布为数字资产 " + project.getPublishedAvatarId() + "，暂不支持追加发布");
        }
        if (req == null || req.masterNodeId() == null || req.masterNodeId().isBlank()) {
            throw BusinessException.badRequest("IP_PUBLISH_SELECTION_REQUIRED", "请先选择要发布的主形象节点");
        }

        // 资产名是发布产物在资产库里的身份，不能悄悄拿项目名替 —— 用户在发布框里删空了名字，
        // 结果资产叫「未命名 IP 项目」，他只会以为发布坏了。
        if (req.avatarName() == null || req.avatarName().isBlank()) {
            throw BusinessException.badRequest("IP_PUBLISH_NAME_REQUIRED", "请填写数字资产名称");
        }

        JsonNode doc = projects.readDoc(project);
        Selected master = selectedOf(userId, doc, projectId, req.masterNodeId());

        List<String> lookNodeIds = req.lookNodeIds() == null ? List.of() : req.lookNodeIds();
        List<Selected> looks = new ArrayList<>();
        for (String nodeId : lookNodeIds) {
            if (nodeId == null || nodeId.isBlank() || nodeId.equals(req.masterNodeId())) continue;
            looks.add(selectedOf(userId, doc, projectId, nodeId));
        }

        Identity identity = identityOf(doc, req.masterNodeId());
        String avatarName = req.avatarName().trim();
        if (avatarName.length() > 128) avatarName = avatarName.substring(0, 128);

        int hue = 20 + RND.nextInt(320);
        Map<String, Object> deriv = new LinkedHashMap<>();
        Map<String, Object> counts = new LinkedHashMap<>();
        DapAvatarService.DERIV_KEYS.forEach(k -> { deriv.put(k, "empty"); counts.put(k, 0); });

        DapAvatar avatar = DapAvatar.builder()
                .id(avatars.uniqueId("DH"))
                .ownerUserId(userId)
                .name(avatarName)
                .codename("ip-studio")
                .path("ai")
                .archetype("IP 工作台形象")
                .tagline(identity.tagline())
                .status("finalized")
                .hue(hue)
                .hairStyle("short")
                .palette(support.paletteFor(hue))
                .def(identity.def())
                .deriv(deriv)
                .counts(counts)
                .versions(1)
                .engine(engineLabel())
                .imageKey(master.imageKey())
                .variantKeys(new ArrayList<>(master.allCandidateKeys()))
                .basePrompt(identity.promptEn())
                .descPrompt(identity.text())
                .templateId(project.getTemplateId())
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        avatars.save(avatar);
        avatars.addVersionAt(avatar, 1, "IP 工作台发布 · 主形象", "init", master.imageKey());

        List<String> lookIds = new ArrayList<>();
        for (Selected s : looks) {
            String lookId = "LK-" + IpProjectService.hex8();
            lookRepo.save(DapLook.builder()
                    .id(lookId)
                    .avatarId(avatar.getId())
                    .ownerUserId(userId)
                    .label(s.title())
                    .source("design")
                    .prompt(s.prompt())
                    .status("done")
                    .imageKey(s.imageKey())
                    .bytes(0)
                    .createdAt(Instant.now())
                    .build());
            lookIds.add(lookId);
        }
        if (!lookIds.isEmpty()) {
            Map<String, Object> c = avatar.countsOrEmpty();
            c.put("look", lookIds.size());
            avatar.setCounts(c);
            avatars.save(avatar);
        }

        project.setStatus(IpProject.STATUS_PUBLISHED);
        project.setPublishedAvatarId(avatar.getId());
        project.setCoverKey(master.imageKey());
        projects.save(project);

        log.info("[ipstudio] 发布完成 project={} avatar={} looks={}", projectId, avatar.getId(), lookIds.size());
        return new IpPublishResultDto(avatar.getId(), lookIds);
    }

    // ── 选中候选解析 ─────────────────────────────────────────

    private record Selected(String nodeId, String title, String imageKey, String prompt,
                            List<String> allCandidateKeys) {}

    /** 节点必须是 generate 且已有选中候选，否则 400 —— 没选图就发布只会产出一个空壳资产。 */
    private Selected selectedOf(String userId, JsonNode doc, String projectId, String nodeId) {
        JsonNode node = IpDocs.node(doc, nodeId);
        if (node == null) {
            throw BusinessException.notFound("IP_NODE_NOT_FOUND", "画布上找不到节点 " + nodeId);
        }
        if (!IpDocs.T_GENERATE.equals(IpDocs.typeOf(node))) {
            throw BusinessException.badRequest("IP_PUBLISH_SELECTION_REQUIRED",
                    "只能发布「生成」节点的选中图");
        }
        JsonNode d = IpDocs.dataOf(node);
        String runId = IpDocs.text(d, "selectedRunId");
        if (runId == null) {
            throw BusinessException.badRequest("IP_PUBLISH_SELECTION_REQUIRED",
                    "还有生成节点没有选定图片，请先在候选里选一张");
        }
        // owner + project 双限定（与参考图装配同一把闸）：doc 是客户端写的，
        // 抄一个别人的 runId 进来就能把别人的图发布成自己的资产。
        IpRun run = projects.ownedRun(userId, projectId, runId).orElseThrow(() ->
                BusinessException.badRequest("IP_PUBLISH_SELECTION_REQUIRED",
                        "选定的图片已失效，请重新生成并选图"));
        String key = projects.candidateKeyOf(userId, projectId, runId, d.path("selectedIndex").asInt(0));
        if (key == null) {
            throw BusinessException.badRequest("IP_PUBLISH_SELECTION_REQUIRED",
                    "选定的图片已失效，请重新生成并选图");
        }
        JsonNode out = projects.parseOrEmptyObject(run.getOutputJson());
        List<String> all = new ArrayList<>();
        JsonNode arr = out.path("candidates");
        if (arr.isArray()) {
            for (JsonNode c : arr) {
                String k = c.path("key").asText(null);
                if (k != null && !k.isBlank()) all.add(k);
            }
        }
        JsonNode inputs = projects.parseOrEmptyObject(run.getInputJson());
        String prompt = inputs.path("prompt").isTextual() ? inputs.path("prompt").asText() : null;

        String title = lookTitleFor(doc, nodeId);
        return new Selected(nodeId, title, key, prompt, all);
    }

    /** 造型名取上游形象卡的 title，没有就退到节点 label / 默认名。 */
    private String lookTitleFor(JsonNode doc, String nodeId) {
        for (JsonNode look : IpDocs.ancestorsOfType(doc, nodeId, IpDocs.T_LOOK, 2)) {
            String t = IpDocs.text(IpDocs.dataOf(look), "title");
            if (t != null) return t.length() > 128 ? t.substring(0, 128) : t;
        }
        JsonNode node = IpDocs.node(doc, nodeId);
        String label = node == null ? null : IpDocs.text(node, "label");
        return label != null ? label : "IP 造型";
    }

    // ── 特征卡 → dap 设定档案 ────────────────────────────────

    private record Identity(String text, String promptEn, String tagline, Map<String, Object> def) {}

    private Identity identityOf(JsonNode doc, String masterNodeId) {
        String text = null, promptEn = null;
        List<JsonNode> ids = IpDocs.ancestorsOfType(doc, masterNodeId, IpDocs.T_IDENTITY, 8);
        if (!ids.isEmpty()) {
            JsonNode d = IpDocs.dataOf(ids.get(0));
            text = IpDocs.text(d, "text");
            promptEn = IpDocs.text(d, "promptEn");
        }
        Map<String, Object> def = new LinkedHashMap<>();
        def.put("形象来源", "AI IP 工作台");
        parseCard(text).forEach(def::putIfAbsent);
        def.putIfAbsent("核心气质", "—");
        def.putIfAbsent("脸部特征", "—");
        def.putIfAbsent("发型妆造", "—");
        def.put("设定语", text == null ? "" : text);
        String tagline = def.get("核心气质") instanceof String s && !"—".equals(s) ? s : "IP 工作台形象";
        return new Identity(text, promptEn, tagline.length() > 256 ? tagline.substring(0, 256) : tagline, def);
    }

    /** 把「脸型：鹅蛋脸」这类逐行小标题解析成 def 键值；解析不出来不报错（设定语里仍有原文）。 */
    static Map<String, Object> parseCard(String text) {
        Map<String, Object> out = new LinkedHashMap<>();
        if (text == null || text.isBlank()) return out;
        for (String rawLine : text.split("\\r?\\n")) {
            String line = rawLine.trim().replaceFirst("^[-*·•\\s]+", "");
            int sep = indexOfSeparator(line);
            if (sep <= 0) continue;
            String label = line.substring(0, sep).trim();
            String value = line.substring(sep + 1).trim();
            if (label.isEmpty() || value.isEmpty()) continue;
            String mapped = DEF_LABEL_MAP.get(label);
            if (mapped == null) continue;
            Object existing = out.get(mapped);
            out.put(mapped, existing == null ? value : existing + " / " + value);
        }
        return out;
    }

    private static int indexOfSeparator(String line) {
        int a = line.indexOf('：');
        int b = line.indexOf(':');
        if (a < 0) return b;
        if (b < 0) return a;
        return Math.min(a, b);
    }

    private String engineLabel() {
        String m = multimodal.imageModel();
        return m == null || m.isBlank() ? "云端图像引擎" : truncate(m, 64);
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max);
    }
}
