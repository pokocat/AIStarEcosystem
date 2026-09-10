package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.model.*;
import com.aistareco.aep.clip.repository.ClipShotJobRepository;
import com.aistareco.aep.clip.service.shiliu.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.*;

/** 段级 worker 的事务边界。独立 bean 避免 {@code @Scheduled} 类内自调用让 {@code @Transactional} 失效。 */
@Service
public class ClipShotJobWorkerState {
    private final ClipShotJobRepository jobs; private final ClipProjectService projects; private final ShiliuService shiliu;
    private final ClipAvatarService avatars; private final ClipOutputStorage outputStorage; private final ClipAssemblyService assembly;
    private final ClipAssetThumbnailExtractor thumbnails;
    public ClipShotJobWorkerState(ClipShotJobRepository jobs, ClipProjectService projects, ShiliuService shiliu,
                                  ClipAvatarService avatars, ClipOutputStorage outputStorage, ClipAssemblyService assembly,
                                  ClipAssetThumbnailExtractor thumbnails) {
        this.jobs=jobs; this.projects=projects; this.shiliu=shiliu; this.avatars=avatars;
        this.outputStorage=outputStorage; this.assembly=assembly; this.thumbnails=thumbnails;
    }

    @Transactional
    public int acquire(String id, String workerId, Collection<String> statuses) {
        Instant now = Instant.now(); return jobs.acquire(id, workerId, now.plusSeconds(300), now, statuses);
    }

    /** 每轮只推进一步（配音 → 建任务 → 取产物）：事务短、失败面小，和整片 worker 同一套节奏。 */
    @Transactional
    public void advance(String id, String workerId) {
        ClipShotJob j = jobs.findById(id).orElse(null);
        if (j == null || !workerId.equals(j.getLeaseOwner()) || ClipShotJobService.TERMINAL.contains(j.getStatus())) return;
        Instant now = Instant.now(); j.setHeartbeatAt(now); j.setUpdatedAt(now);
        ClipProject p = projects.required(j.getExternalOwnerId(), j.getProjectId());
        Map<String,Object> shot = ClipShotJobService.requiredShot(p, j.getShotNo());
        if (j.isMock()) {
            ClipAssemblyService.Result result = assembly.renderMockShot(j.getExternalOwnerId(), shot);
            succeed(j, result.outputCdnKey(), result.thumbnailCdnKey(), result.durationSec(), now);
            release(j); return;
        }
        ShiliuGateway gateway = shiliu.required();
        String avatarId = text(p.getPayloadJson().get("avatarId")); String voiceId = text(p.getPayloadJson().get("voiceId"));
        // 第一步：这一镜的配音。落库留着，重试时不用再烧一次 TTS 的点数。
        if (text(j.getAudioCdnKey()).isBlank()) {
            String voiceRef = avatarId.isBlank() && voiceId.isBlank() ? avatars.requiredVoiceEngineRef(j.getExternalOwnerId()) : avatars.requiredVoiceEngineRef(j.getExternalOwnerId(), avatarId, voiceId);
            ShiliuGateway.Task task = gateway.previewVoice(j.getExternalOwnerId(), voiceRef, text(shot.get("text")));
            if (!"succeeded".equals(task.status()) || (task.outputRef() == null && task.outputCdnKey() == null)) throw new IllegalStateException("配音生成失败" + (task.error() == null ? "" : "：" + task.error()));
            j.setAudioCdnKey(task.outputCdnKey() != null && !task.outputCdnKey().isBlank() ? task.outputCdnKey() : outputStorage.persistAudio(j.getExternalOwnerId(), task.outputRef()));
            j.setStatus("running"); j.setProgress(30); release(j); return;
        }
        // 第二步：拿配音驱动出镜视频。engineTaskId 空就建任务，否则查任务 —— 同一轮不做两件事。
        String avatarRef = avatarId.isBlank() ? avatars.requiredAvatarEngineRef(j.getExternalOwnerId()) : avatars.requiredAvatarEngineRef(j.getExternalOwnerId(), avatarId);
        ShiliuGateway.Task task = text(j.getEngineTaskId()).isBlank()
                ? gateway.createVideoByAudioFile(j.getExternalOwnerId(), avatarRef, j.getAudioCdnKey())
                : gateway.query(j.getEngineTaskId());
        if ("failed".equals(task.status())) throw new IllegalStateException(task.error() == null ? "分身出镜段生成失败" : task.error());
        j.setEngineTaskId(task.id());
        if (!"succeeded".equals(task.status())) {
            j.setStatus("running"); j.setProgress(Math.max(50, Math.min(95, task.progress() == null ? 50 : task.progress()))); release(j); return;
        }
        if (task.outputRef() == null || task.outputRef().isBlank()) throw new IllegalStateException("分身出镜段没有返回视频");
        String videoKey = outputStorage.persist(j.getExternalOwnerId(), task.outputRef());
        // 封面帧抽不出来不算失败：视频本身已经在手上了，为一张缩略图把整单判死是拿用户的钱开玩笑。
        String posterKey = null;
        try { posterKey = thumbnails.extract(j.getExternalOwnerId(), videoKey).key(); } catch (Exception ignored) {}
        double duration = task.durationSec() == null ? ClipProjectService.seconds(shot) : task.durationSec();
        succeed(j, videoKey, posterKey, duration, now); release(j);
    }

    /** 失败落地。**独立事务**：advance 抛异常会整体回滚，失败原因不能跟着一起被回滚掉。 */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(String id, String errorCode, String message) {
        ClipShotJob j = jobs.findById(id).orElse(null);
        if (j == null || ClipShotJobService.TERMINAL.contains(j.getStatus())) return;
        Instant now = Instant.now();
        // credits 一个字都不动：它建单时就是 0，失败也就该停在 0。「失败不扣」不需要退款动作。
        j.setStatus("failed"); j.setErrorCode(errorCode == null || errorCode.isBlank() ? "CLIP_SHOT_FAILED" : errorCode);
        j.setErrorMessage(message); j.setCompletedAt(now); j.setUpdatedAt(now); release(j);
    }

    /**
     * 落成功。产物同时写两处：任务行（这一单的凭据）与项目 payload（产物的真源）。
     * 少写项目那一份，用户换台手机重新拉项目就看不见自己刚花钱买的这一镜。
     */
    private void succeed(ClipShotJob j, String cdnKey, String posterKey, double durationSec, Instant now) {
        Map<String,Object> artifact = new LinkedHashMap<>();
        artifact.put("cdnKey", cdnKey);
        if (posterKey != null && !posterKey.isBlank()) artifact.put("posterCdnKey", posterKey);
        if (j.getFingerprint() != null && !j.getFingerprint().isBlank()) artifact.put("fingerprint", j.getFingerprint());
        artifact.put("durationSec", durationSec); artifact.put("jobId", j.getId());
        projects.recordShotArtifact(j.getExternalOwnerId(), j.getProjectId(), j.getShotNo(), artifact, j.getModel(), j.getPrompt());
        j.setArtifactCdnKey(cdnKey); j.setArtifactPosterCdnKey(posterKey); j.setArtifactDurationSec(durationSec);
        // 「成功才扣」的唯一落点：报价在这一行、这一刻，才第一次变成实扣。
        j.setCredits(j.getQuotedCredits());
        j.setStatus("succeeded"); j.setProgress(100); j.setCompletedAt(now);
    }

    private void release(ClipShotJob j) { j.setLeaseOwner(null); j.setLeaseUntil(null); j.setUpdatedAt(Instant.now()); jobs.save(j); }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }
}
