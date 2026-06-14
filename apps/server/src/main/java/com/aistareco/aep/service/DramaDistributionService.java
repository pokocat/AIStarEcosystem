package com.aistareco.aep.service;

import com.aistareco.aep.model.DramaPlatformConnection;
import com.aistareco.aep.model.DramaPublishJob;
import com.aistareco.aep.repository.DramaPlatformConnectionRepository;
import com.aistareco.aep.repository.DramaPublishJobRepository;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 短剧分发服务（v0.65）：平台目录 + 用户连接 + 发布任务（队列状态机）。
 *
 * 平台目录为服务端静态表；连接 / 任务按 ownerUserId 严格隔离落库。
 * 任务进度由 {@link #tick()} @Scheduled 推进 —— 平台直传通道（OAuth + 官方开放平台上传）
 * 接入前，传输为服务端模拟；状态/进度/产物 URL 全部真实落库，前端轮询拿真数据。
 */
@Service
public class DramaDistributionService {

    private static final Logger log = LoggerFactory.getLogger(DramaDistributionService.class);

    /** 平台静态目录（id/name/icon/category 与前端 @ai-star-eco/types/distribution.Platform 对齐）。 */
    record PlatformDef(String id, String name, String icon, String category) {}

    static final List<PlatformDef> PLATFORMS = List.of(
            new PlatformDef("p1", "爱奇艺", "🎞️", "video"),
            new PlatformDef("p2", "腾讯视频", "📺", "video"),
            new PlatformDef("p3", "优酷", "🎬", "video"),
            new PlatformDef("p4", "芒果 TV", "🥭", "video"),
            new PlatformDef("p5", "抖音", "🎵", "video"),
            new PlatformDef("p6", "快手", "⚡", "video"),
            new PlatformDef("p7", "视频号", "💬", "video"),
            new PlatformDef("p8", "B 站", "📺", "video"),
            new PlatformDef("p9", "小红书", "📕", "social"),
            new PlatformDef("p10", "西瓜视频", "🍉", "video"),
            new PlatformDef("p11", "红果短剧", "🎯", "video"),
            new PlatformDef("p12", "番茄短剧", "🍅", "video"),
            new PlatformDef("p13", "微博", "🌐", "social"),
            new PlatformDef("p14", "YouTube", "▶️", "video"));

    private final DramaPlatformConnectionRepository connRepo;
    private final DramaPublishJobRepository jobRepo;
    private final ObjectMapper om;

    public DramaDistributionService(DramaPlatformConnectionRepository connRepo, DramaPublishJobRepository jobRepo, ObjectMapper om) {
        this.connRepo = connRepo;
        this.jobRepo = jobRepo;
        this.om = om;
    }

    // ── 平台 & 连接 ─────────────────────────────────────────────────────────────

    /** 平台目录 + 当前用户连接状态。 */
    public List<JsonNode> listPlatforms(String userId) {
        var connected = connRepo.findByOwnerUserId(userId);
        List<JsonNode> out = new ArrayList<>();
        for (PlatformDef def : PLATFORMS) {
            var conn = connected.stream().filter(c -> c.getPlatformId().equals(def.id())).findFirst();
            ObjectNode p = om.createObjectNode();
            p.put("id", def.id());
            p.put("name", def.name());
            p.put("icon", def.icon());
            p.put("category", def.category());
            p.put("status", conn.isPresent() ? "connected" : "disconnected");
            p.put("followers", "—");
            p.put("lastSync", conn.map(c -> relativeTime(c.getConnectedAt())).orElse("—"));
            out.add(p);
        }
        return out;
    }

    @Transactional
    public JsonNode connect(String platformId, String userId) {
        PlatformDef def = PLATFORMS.stream().filter(p -> p.id().equals(platformId)).findFirst()
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PLATFORM_NOT_FOUND", "平台不存在"));
        DramaPlatformConnection conn = connRepo.findByOwnerUserIdAndPlatformId(userId, platformId)
                .orElseGet(() -> connRepo.save(DramaPlatformConnection.builder()
                        .id("dpc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10))
                        .ownerUserId(userId)
                        .platformId(platformId)
                        .connectedAt(OffsetDateTime.now())
                        .build()));
        ObjectNode out = om.createObjectNode();
        out.put("id", conn.getId());
        out.put("platformId", def.id());
        out.put("platformName", def.name());
        out.put("status", "connected");
        out.put("connectedAt", conn.getConnectedAt().toString());
        return out;
    }

    @Transactional
    public void disconnect(String platformId, String userId) {
        connRepo.findByOwnerUserIdAndPlatformId(userId, platformId).ifPresent(connRepo::delete);
    }

    // ── 发布任务 ────────────────────────────────────────────────────────────────

    public List<JsonNode> listJobs(String userId, String projectId) {
        List<DramaPublishJob> rows = (projectId == null || projectId.isBlank())
                ? jobRepo.findByOwnerUserIdOrderByCreatedAtDesc(userId)
                : jobRepo.findByOwnerUserIdAndProjectIdOrderByCreatedAtDesc(userId, projectId);
        return rows.stream().<JsonNode>map(this::toCard).toList();
    }

    public JsonNode getJob(String id, String userId) {
        return jobRepo.findByIdAndOwnerUserId(id, userId).map(this::toCard)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PUBLISH_JOB_NOT_FOUND", "发布任务不存在"));
    }

    /** body: { projectId, platformId, platformName?, scheduledAt? } */
    @Transactional
    public JsonNode createJob(JsonNode body, String userId) {
        String projectId = text(body, "projectId");
        String platformId = text(body, "platformId");
        if (projectId == null || projectId.isBlank() || platformId == null || platformId.isBlank()) {
            throw new BusinessException(HttpStatus.BAD_REQUEST, "PUBLISH_JOB_PARAMS_REQUIRED", "缺少项目或平台参数");
        }
        if (connRepo.findByOwnerUserIdAndPlatformId(userId, platformId).isEmpty()) {
            throw new BusinessException(HttpStatus.CONFLICT, "PLATFORM_NOT_CONNECTED", "请先连接该平台再发布");
        }
        String platformName = PLATFORMS.stream().filter(p -> p.id().equals(platformId))
                .map(PlatformDef::name).findFirst().orElse(orDefault(text(body, "platformName"), platformId));
        OffsetDateTime now = OffsetDateTime.now();
        OffsetDateTime scheduledAt = null;
        String sched = text(body, "scheduledAt");
        if (sched != null && !sched.isBlank()) {
            try {
                scheduledAt = OffsetDateTime.parse(sched);
            } catch (Exception e) {
                throw new BusinessException(HttpStatus.BAD_REQUEST, "PUBLISH_SCHEDULE_INVALID", "定时发布时间格式不合法");
            }
        }
        DramaPublishJob job = jobRepo.save(DramaPublishJob.builder()
                .id("dpj_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10))
                .ownerUserId(userId)
                .projectId(projectId)
                .platformId(platformId)
                .platformName(platformName)
                .status("queued")
                .progress(0)
                .scheduledAt(scheduledAt)
                .createdAt(now)
                .updatedAt(now)
                .build());
        log.info("[drama-dist] job created user={} project={} platform={} scheduled={}",
                userId, projectId, platformId, scheduledAt);
        return toCard(job);
    }

    @Transactional
    public JsonNode retryJob(String id, String userId) {
        DramaPublishJob job = requireJob(id, userId);
        if (!"failed".equals(job.getStatus()) && !"cancelled".equals(job.getStatus())) {
            throw new BusinessException(HttpStatus.CONFLICT, "PUBLISH_JOB_NOT_RETRYABLE", "仅失败/已取消的任务可重试");
        }
        job.setStatus("queued");
        job.setProgress(0);
        job.setErrorMessage(null);
        job.setUpdatedAt(OffsetDateTime.now());
        return toCard(jobRepo.save(job));
    }

    @Transactional
    public JsonNode cancelJob(String id, String userId) {
        DramaPublishJob job = requireJob(id, userId);
        if ("live".equals(job.getStatus())) {
            throw new BusinessException(HttpStatus.CONFLICT, "PUBLISH_JOB_ALREADY_LIVE", "已上线的任务无法取消");
        }
        job.setStatus("cancelled");
        job.setUpdatedAt(OffsetDateTime.now());
        return toCard(jobRepo.save(job));
    }

    /** 队列推进：每 2s 把进行中的任务往前推（直传通道接入前的服务端模拟传输）。 */
    @Scheduled(fixedDelay = 2000)
    @Transactional
    public void tick() {
        List<DramaPublishJob> active = jobRepo.findByStatusIn(
                List.of("queued", "uploading", "transcoding", "publishing"));
        if (active.isEmpty()) return;
        OffsetDateTime now = OffsetDateTime.now();
        for (DramaPublishJob job : active) {
            if ("queued".equals(job.getStatus())
                    && job.getScheduledAt() != null && job.getScheduledAt().isAfter(now)) {
                continue; // 定时任务未到点
            }
            int next = Math.min(100, job.getProgress() + 12 + (int) (Math.random() * 7));
            job.setProgress(next);
            if (next >= 100) {
                job.setStatus("live");
                job.setExternalUrl("https://v.example.com/" + job.getPlatformId() + "/" + job.getId());
            } else if (next >= 70) {
                job.setStatus("publishing");
            } else if (next >= 40) {
                job.setStatus("transcoding");
            } else {
                job.setStatus("uploading");
            }
            job.setUpdatedAt(now);
        }
        jobRepo.saveAll(active);
    }

    // ── 工具 ────────────────────────────────────────────────────────────────────

    private DramaPublishJob requireJob(String id, String userId) {
        return jobRepo.findByIdAndOwnerUserId(id, userId)
                .orElseThrow(() -> new BusinessException(HttpStatus.NOT_FOUND, "PUBLISH_JOB_NOT_FOUND", "发布任务不存在"));
    }

    private ObjectNode toCard(DramaPublishJob job) {
        ObjectNode card = om.createObjectNode();
        card.put("id", job.getId());
        card.put("projectId", job.getProjectId());
        card.put("platformId", job.getPlatformId());
        card.put("platformName", job.getPlatformName());
        card.put("status", job.getStatus());
        card.put("progress", job.getProgress());
        card.put("createdAt", job.getCreatedAt() != null ? job.getCreatedAt().toString() : null);
        card.put("updatedAt", job.getUpdatedAt() != null ? job.getUpdatedAt().toString() : null);
        if (job.getScheduledAt() != null) card.put("scheduledAt", job.getScheduledAt().toString());
        if (job.getExternalUrl() != null) card.put("externalUrl", job.getExternalUrl());
        if (job.getErrorMessage() != null) card.put("errorMessage", job.getErrorMessage());
        return card;
    }

    private static String relativeTime(OffsetDateTime t) {
        if (t == null) return "—";
        long min = Duration.between(t, OffsetDateTime.now()).toMinutes();
        if (min <= 0) return "刚刚";
        if (min < 60) return min + " 分钟前";
        long h = min / 60;
        if (h < 24) return h + " 小时前";
        return (h / 24) + " 天前";
    }

    private static String text(JsonNode n, String f) {
        JsonNode v = n == null ? null : n.get(f);
        return v == null || v.isNull() ? null : v.asText();
    }

    private static String orDefault(String v, String d) {
        return v == null || v.isBlank() ? d : v;
    }
}
