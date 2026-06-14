package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaShort;
import com.aistareco.aep.repository.DramaShortRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 短视频制作草稿服务（v0.76，drama 子产品）。
 *
 * 只做一件事：短视频工坊整页编辑态的可恢复草稿 CRUD（按 ownerUserId 隔离 + 软删）。
 * AI 出脚本 / 出首帧 / 出片仍走既有端点（/me/drama/scripts/ai-draft、/me/drama/render/*），
 * 本服务只负责把「做到一半」的整页状态持久化，让刷新 / 返回 / 换设备都能接着做。
 *
 * 列表卡片用核心字段（标题 / 模版 / 封面 / 时长 / 进度 / 状态）；
 * 详情/保存用整套 payloadJson（前端 ShortDraftData TS 接口即契约真源）。
 * 落库时按 payload 回算 title / durationSec / shotCount / doneCount / progress，列表才同步。
 */
@Service
public class DramaShortService {

    private static final Logger log = LoggerFactory.getLogger(DramaShortService.class);

    private final DramaShortRepository repo;
    private final ObjectMapper om;

    public DramaShortService(DramaShortRepository repo, ObjectMapper om) {
        this.repo = repo;
        this.om = om;
    }

    // ── CRUD ───────────────────────────────────────────────────────────────────

    /** 列表卡片（ShortDraftSummary[]）。 */
    public List<JsonNode> listShorts(String userId) {
        if (userId == null || userId.isBlank()) return List.of();
        List<JsonNode> out = new ArrayList<>();
        for (DramaShort s : repo.findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(userId)) {
            out.add(toSummary(s));
        }
        return out;
    }

    /** 详情：{ meta: ShortDraftSummary, data: ShortDraftData }。 */
    public JsonNode getShort(String id, String userId) {
        return toDetail(requireOwned(id, userId));
    }

    /**
     * 新建短视频草稿。body: { title?, fmtKey?, fmtName?, coverFrom?, coverTo?, idea?, reopen? }
     * → seed 一份最小但合法的 ShortDraftData，返回 { meta, data }。
     */
    public JsonNode createShort(JsonNode body, String userId) {
        if (body == null || !body.isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SHORT_BODY_REQUIRED", "缺少新建短视频参数");
        }
        OffsetDateTime now = OffsetDateTime.now();
        String fmtKey = text(body, "fmtKey");
        String fmtName = orDefault(text(body, "fmtName"), fmtKey == null ? "短视频" : fmtKey);
        String idea = text(body, "idea");
        String reopen = text(body, "reopen");
        String title = orDefault(text(body, "title"),
                orDefault(idea, orDefault(reopen, fmtKey == null ? "未命名短视频" : fmtName)));

        DramaShort row = DramaShort.builder()
                .id("dvs_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(userId)
                .title(title)
                .fmtKey(fmtKey)
                .fmtName(fmtName)
                .coverFrom(orDefault(text(body, "coverFrom"), "#f97316"))
                .coverTo(orDefault(text(body, "coverTo"), "#e11d48"))
                .durationSec(0)
                .shotCount(0)
                .doneCount(0)
                .status("draft")
                .progress(0)
                .payloadJson(write(seedData(title, fmtKey, fmtName, idea, reopen)))
                .createdAt(now)
                .updatedAt(now)
                .build();
        repo.save(row);
        log.info("[drama-short] create user={} id={} fmt={}", userId, row.getId(), fmtKey);
        return toDetail(row);
    }

    /**
     * 保存整页草稿。body: { data: ShortDraftData, status?, progress? } → 落库并回算卡片字段。
     */
    public JsonNode saveShort(String id, JsonNode body, String userId) {
        DramaShort row = requireOwned(id, userId);
        if (body == null || !body.has("data") || !body.get("data").isObject()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "DRAMA_SHORT_DATA_REQUIRED", "缺少要保存的短视频数据");
        }
        ObjectNode data = ((ObjectNode) body.get("data")).deepCopy();

        // 标题：优先整体说明 meta.title，其次 data.title，再次原标题。
        String metaTitle = data.path("meta").path("title").asText(null);
        String dataTitle = text(data, "title");
        String title = orDefault(metaTitle, orDefault(dataTitle, row.getTitle()));
        if (title != null && !title.isBlank()) row.setTitle(title);
        String fmtKey = text(data, "fmtKey");
        if (fmtKey != null && !fmtKey.isBlank()) row.setFmtKey(fmtKey);
        String fmtName = text(data, "fmtName");
        if (fmtName != null && !fmtName.isBlank()) row.setFmtName(fmtName);

        // 由分镜回算时长 / 镜数 / 已成片数 / 进度。
        int dur = 0, shotCount = 0, doneCount = 0;
        JsonNode shots = data.path("shots");
        if (shots.isArray()) {
            shotCount = shots.size();
            for (JsonNode sh : shots) {
                dur += sh.path("dur").asInt(0);
                if ("done".equals(sh.path("flow").asText(""))) doneCount++;
            }
        }
        row.setDurationSec(dur);
        row.setShotCount(shotCount);
        row.setDoneCount(doneCount);

        if (body.has("status")) {
            String st = body.path("status").asText("draft");
            row.setStatus("done".equals(st) ? "done" : "draft");
        }
        int progress = body.has("progress")
                ? clamp(body.path("progress").asInt(0), 0, 100)
                : (shotCount > 0 ? clamp(doneCount * 100 / shotCount, 0, 100) : 0);
        row.setProgress(progress);

        row.setPayloadJson(write(data));
        row.setUpdatedAt(OffsetDateTime.now());
        repo.save(row);
        return toDetail(row);
    }

    public void deleteShort(String id, String userId) {
        DramaShort row = repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId).orElse(null);
        if (row == null) return;
        row.setDeletedAt(OffsetDateTime.now());
        repo.save(row);
    }

    /**
     * v0.77：从「单集创意」（创意市场已发布 Recipe，episodes≤1）套用生成一条短视频草稿。
     *
     * 与用户自建短视频不同：不套短视频模版（fmtKey=null），而是把创意的风格 / 方法作为
     * styleName + styleRef 落进草稿。短视频工厂的 AI 出脚本时把 styleRef 当风格参考，
     * 让成片照这个创意的风格走（不直接复述创意说明，而是按其风格拆你的主题）。返回新草稿 id。
     */
    public String createFromRecipe(String userId, String title, String type,
                                   String coverFrom, String coverTo,
                                   String styleName, String styleRef) {
        OffsetDateTime now = OffsetDateTime.now();
        String safeTitle = orDefault(title, "未命名短视频");
        String fmtName = orDefault(type, "风格短片");

        ObjectNode data = om.createObjectNode();
        data.putNull("idea");
        data.putNull("reopen");
        data.putNull("fmtKey");
        data.put("fmtName", fmtName);
        data.put("title", safeTitle);
        if (styleName != null && !styleName.isBlank()) data.put("styleName", styleName);
        if (styleRef != null && !styleRef.isBlank()) data.put("styleRef", styleRef);
        data.put("step", "script");
        data.putNull("meta");
        data.set("shots", om.createArrayNode());
        data.set("chat", om.createArrayNode());
        data.set("refs", om.createArrayNode());

        DramaShort row = DramaShort.builder()
                .id("dvs_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12))
                .ownerUserId(userId)
                .title(safeTitle)
                .fmtKey(null)
                .fmtName(fmtName)
                .coverFrom(orDefault(coverFrom, "#f97316"))
                .coverTo(orDefault(coverTo, "#e11d48"))
                .durationSec(0)
                .shotCount(0)
                .doneCount(0)
                .status("draft")
                .progress(0)
                .payloadJson(write(data))
                .createdAt(now)
                .updatedAt(now)
                .build();
        repo.save(row);
        log.info("[drama-short] create-from-recipe user={} id={} style={}", userId, row.getId(), styleName);
        return row.getId();
    }

    // ── 内部工具 ────────────────────────────────────────────────────────────────

    private DramaShort requireOwned(String id, String userId) {
        return repo.findByIdAndOwnerUserIdAndDeletedAtIsNull(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "DRAMA_SHORT_NOT_FOUND", "短视频草稿不存在"));
    }

    /** 新建时的最小 ShortDraftData（结构合法、各数组为空，前端各步渲染空状态 + 自动补开场白）。 */
    private ObjectNode seedData(String title, String fmtKey, String fmtName, String idea, String reopen) {
        ObjectNode root = om.createObjectNode();
        if (idea != null) root.put("idea", idea); else root.putNull("idea");
        if (reopen != null) root.put("reopen", reopen); else root.putNull("reopen");
        if (fmtKey != null) root.put("fmtKey", fmtKey); else root.putNull("fmtKey");
        root.put("fmtName", fmtName);
        root.put("title", title);
        root.put("step", "script");
        root.putNull("meta");
        root.set("shots", om.createArrayNode());
        root.set("chat", om.createArrayNode());
        root.set("refs", om.createArrayNode());
        return root;
    }

    private JsonNode readPayload(DramaShort row) {
        try {
            return row.getPayloadJson() != null ? om.readTree(row.getPayloadJson()) : om.createObjectNode();
        } catch (Exception e) {
            return om.createObjectNode();
        }
    }

    private ObjectNode toSummary(DramaShort s) {
        ObjectNode o = om.createObjectNode();
        o.put("id", s.getId());
        o.put("title", orDefault(s.getTitle(), "未命名短视频"));
        if (s.getFmtKey() != null) o.put("fmtKey", s.getFmtKey()); else o.putNull("fmtKey");
        o.put("fmtName", orDefault(s.getFmtName(), "短视频"));
        o.put("from", orDefault(s.getCoverFrom(), "#f97316"));
        o.put("to", orDefault(s.getCoverTo(), "#e11d48"));
        o.put("durationSec", s.getDurationSec());
        o.put("shotCount", s.getShotCount());
        o.put("doneCount", s.getDoneCount());
        o.put("status", orDefault(s.getStatus(), "draft"));
        o.put("progress", s.getProgress());
        o.put("updated", relativeTime(s.getUpdatedAt()));
        o.put("updatedAt", s.getUpdatedAt() != null ? s.getUpdatedAt().toString() : null);
        return o;
    }

    private ObjectNode toDetail(DramaShort s) {
        ObjectNode out = om.createObjectNode();
        out.set("meta", toSummary(s));
        out.set("data", readPayload(s));
        return out;
    }

    private static String relativeTime(OffsetDateTime t) {
        if (t == null) return "刚刚";
        long days = Duration.between(t, OffsetDateTime.now()).toDays();
        if (days <= 0) return "今天";
        if (days == 1) return "昨天";
        if (days < 7) return days + " 天前";
        return (days / 7) + " 周前";
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }

    private String write(JsonNode node) {
        try {
            return om.writeValueAsString(node);
        } catch (Exception e) {
            return "{}";
        }
    }
}
