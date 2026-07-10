package com.aistareco.aep.service;

import com.aistareco.aep.config.DramaFrameProperties;
import com.aistareco.aep.config.MaterialVideoProperties;
import com.aistareco.aep.model.DramaFrameJob;
import com.aistareco.aep.repository.DramaFrameJobRepository;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoJobService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * 短剧首帧任务 + 统一渲染任务视图。
 */
@Service
public class DramaFrameJobService {

    private static final List<String> VIDEO_RUNNING = List.of("submitting", "generating");

    private final DramaFrameJobRepository frameRepo;
    private final MaterialVideoJobRepository videoRepo;
    private final MaterialVideoJobService videoJobs;
    private final DramaFrameJobWorker worker;
    private final DramaFrameProperties frameProps;
    private final MaterialVideoProperties videoProps;
    private final ObjectMapper om;

    public DramaFrameJobService(DramaFrameJobRepository frameRepo,
                                MaterialVideoJobRepository videoRepo,
                                MaterialVideoJobService videoJobs,
                                DramaFrameJobWorker worker,
                                DramaFrameProperties frameProps,
                                MaterialVideoProperties videoProps,
                                ObjectMapper om) {
        this.frameRepo = frameRepo;
        this.videoRepo = videoRepo;
        this.videoJobs = videoJobs;
        this.worker = worker;
        this.frameProps = frameProps;
        this.videoProps = videoProps;
        this.om = om;
    }

    @Transactional
    public JsonNode submitFrame(JsonNode body, String userId) {
        OffsetDateTime now = OffsetDateTime.now();
        String id = "dfj_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        DramaFrameJob job = DramaFrameJob.builder()
                .id(id)
                .ownerUserId(userId)
                .projectId(text(body, "project_id"))
                .sceneId(text(body, "scene_id"))
                .shotId(text(body, "shot_id"))
                .episodeNo(body != null && body.hasNonNull("episode_no") ? body.path("episode_no").asInt() : null)
                .kind(orDefault(text(body, "kind"), "shot"))
                .name(orDefault(text(body, "name"), "首帧渲染"))
                .requestJson(write(body))
                .status("queued")
                .progress(0)
                .stage("排队中")
                .createdAt(now)
                .updatedAt(now)
                .build();
        frameRepo.save(job);

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() {
                    worker.generateAsync(id);
                }
            });
        } else {
            worker.generateAsync(id);
        }
        return toFrameTask(job);
    }

    @Transactional(readOnly = true)
    public JsonNode getFrameJob(String id, String userId) {
        if (id == null || userId == null) return null;
        return frameRepo.findById(id)
                .filter(j -> userId.equals(j.getOwnerUserId()))
                .map(this::toFrameTask)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<JsonNode> listFrameJobs(String userId, String projectId) {
        if (userId == null || userId.isBlank()) return List.of();
        List<DramaFrameJob> rows = projectId != null && !projectId.isBlank()
                ? frameRepo.findTop50ByOwnerUserIdAndProjectIdOrderByCreatedAtDesc(userId, projectId)
                : frameRepo.findTop50ByOwnerUserIdOrderByCreatedAtDesc(userId);
        return rows.stream().map(j -> (JsonNode) toFrameTask(j)).toList();
    }

    @Transactional(readOnly = true)
    public JsonNode listTasks(String userId, String projectId) {
        ObjectNode out = om.createObjectNode();
        out.set("summary", taskSummary(userId));

        List<JsonNode> all = new ArrayList<>();
        all.addAll(listFrameJobs(userId, projectId));
        List<JsonNode> videos = projectId != null && !projectId.isBlank()
                ? videoJobs.listJobs(userId, projectId, null)
                : videoJobs.listJobs(userId, null, null);
        videos.stream().map(this::toVideoTask).forEach(all::add);
        all.sort(Comparator.comparing((JsonNode n) -> n.path("created_at").asText("")).reversed());

        ArrayNode tasks = om.createArrayNode();
        all.stream().limit(80).forEach(tasks::add);
        out.set("tasks", tasks);
        return out;
    }

    @Transactional(readOnly = true)
    public JsonNode taskSummary(String userId) {
        long frameQueued = frameRepo.countByStatus("queued");
        long frameRunning = frameRepo.countByStatus("running");
        long videoQueued = videoRepo.countByStatus("queued");
        long videoRunning = videoRepo.countByStatusIn(VIDEO_RUNNING);

        ObjectNode out = om.createObjectNode();
        out.set("frame", laneSummary(frameQueued, frameRunning, frameProps.getMaxConcurrent(),
                userId == null ? 0 : frameRepo.countByOwnerUserIdAndStatus(userId, "queued"),
                userId == null ? 0 : frameRepo.countByOwnerUserIdAndStatus(userId, "running")));
        out.set("video", laneSummary(videoQueued, videoRunning, videoProps.getMaxConcurrent(),
                userId == null ? 0 : videoRepo.countByOwnerUserIdAndStatus(userId, "queued"),
                userId == null ? 0 : videoRepo.countByOwnerUserIdAndStatusIn(userId, VIDEO_RUNNING)));
        ObjectNode total = om.createObjectNode();
        total.put("queued", frameQueued + videoQueued);
        total.put("running", frameRunning + videoRunning);
        total.put("limit", Math.max(1, frameProps.getMaxConcurrent()) + Math.max(1, videoProps.getMaxConcurrent()));
        out.set("total", total);
        return out;
    }

    private ObjectNode laneSummary(long queued, long running, int limit, long mineQueued, long mineRunning) {
        ObjectNode n = om.createObjectNode();
        n.put("queued", queued);
        n.put("running", running);
        n.put("limit", Math.max(1, limit));
        n.put("mine_queued", mineQueued);
        n.put("mine_running", mineRunning);
        return n;
    }

    private ObjectNode toFrameTask(DramaFrameJob job) {
        ObjectNode n = om.createObjectNode();
        n.put("id", job.getId());
        n.put("task_type", "frame");
        n.put("kind", orDefault(job.getKind(), "shot"));
        n.put("name", orDefault(job.getName(), "首帧渲染"));
        n.put("status", wireStatus(job.getStatus()));
        n.put("internal_status", job.getStatus());
        n.put("progress_pct", job.getProgress());
        n.put("stage", stageLabel(job.getStatus(), job.getStage()));
        if (job.getProjectId() != null) n.put("project_id", job.getProjectId());
        if (job.getSceneId() != null) n.put("scene_id", job.getSceneId());
        if (job.getShotId() != null) n.put("shot_id", job.getShotId());
        if (job.getEpisodeNo() != null) n.put("episode_no", job.getEpisodeNo());
        if (job.getErrorMessage() != null) n.put("error_message", job.getErrorMessage());
        putTime(n, "created_at", job.getCreatedAt());
        putTime(n, "started_at", job.getStartedAt());
        putTime(n, "completed_at", job.getCompletedAt());
        JsonNode result = parse(job.getResultJson());
        if (result != null && result.isObject()) {
            n.set("result", result);
            if (result.has("frames")) n.set("frames", result.get("frames"));
            if (result.has("cost")) n.set("cost", result.get("cost"));
            // C-1：把 renderFrame 产出的参考生效回报透传到任务卡，供前端「参考 N/M 生效」chip。
            if (result.has("applied_refs")) n.set("applied_refs", result.get("applied_refs"));
        }
        return n;
    }

    private ObjectNode toVideoTask(JsonNode card) {
        ObjectNode n = om.createObjectNode();
        n.put("id", card.path("id").asText(""));
        n.put("task_type", "video");
        n.put("kind", card.path("kind").asText("drama-shot"));
        n.put("name", card.path("name").asText("分镜视频"));
        n.put("status", card.path("status").asText("rendering"));
        n.put("progress_pct", card.path("progress_pct").asInt(card.path("status").asText("").equals("ready") ? 100 : 0));
        n.put("stage", card.path("stage").asText("处理中"));
        if (card.hasNonNull("script_id")) n.put("project_id", card.path("script_id").asText());
        JsonNode vc = card.get("variant_config");
        if (vc != null && vc.isObject()) {
            putText(n, "shot_id", vc, "shot_id");
            putText(n, "scene_id", vc, "scene_id");
            putText(n, "target", vc, "target");
            if (vc.hasNonNull("episode_no")) n.put("episode_no", vc.path("episode_no").asInt());
        }
        if (card.hasNonNull("duration_sec")) n.put("duration_sec", card.path("duration_sec").asInt());
        if (card.hasNonNull("video_url")) n.put("video_url", card.path("video_url").asText());
        if (card.hasNonNull("thumbnail_url")) n.put("thumbnail_url", card.path("thumbnail_url").asText());
        if (card.hasNonNull("error_message")) n.put("error_message", card.path("error_message").asText());
        if (card.hasNonNull("created_at")) n.put("created_at", card.path("created_at").asText());
        if (card.hasNonNull("generated_at")) n.put("completed_at", card.path("generated_at").asText());
        n.set("source", card);
        return n;
    }

    private static String wireStatus(String status) {
        if ("succeeded".equals(status)) return "ready";
        if ("failed".equals(status)) return "failed";
        if ("running".equals(status)) return "running";
        return "queued";
    }

    private static String stageLabel(String status, String stage) {
        if (stage != null && !stage.isBlank()) return stage;
        if ("succeeded".equals(status)) return "已完成";
        if ("failed".equals(status)) return "失败";
        if ("running".equals(status)) return "生成中";
        return "排队中";
    }

    private JsonNode parse(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return om.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    private String write(JsonNode node) {
        try {
            return om.writeValueAsString(node == null ? om.createObjectNode() : node);
        } catch (Exception e) {
            return "{}";
        }
    }

    private static void putTime(ObjectNode n, String field, OffsetDateTime t) {
        if (t != null) n.put(field, t.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
    }

    private static void putText(ObjectNode out, String outField, JsonNode in, String inField) {
        if (in.hasNonNull(inField)) out.put(outField, in.path(inField).asText());
    }

    private static String text(JsonNode n, String field) {
        JsonNode v = n == null ? null : n.get(field);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
