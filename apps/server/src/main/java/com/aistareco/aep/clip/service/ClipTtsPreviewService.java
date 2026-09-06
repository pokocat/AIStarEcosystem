package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.dto.ClipDtos;
import com.aistareco.aep.clip.dto.ClipDtos.TtsPreviewDto;
import com.aistareco.aep.clip.dto.ClipDtos.TtsPreviewSegmentDto;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.model.ClipTtsPreview;
import com.aistareco.aep.clip.repository.ClipTtsPreviewRepository;
import com.aistareco.aep.clip.service.shiliu.ShiliuGateway;
import com.aistareco.aep.clip.service.shiliu.ShiliuService;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/**
 * 配音（TTS）预览时间线（WORKPLAN 2026-09-05 §1.5）。
 *
 * <p><b>为什么要有它</b>：用户在出片确认页看到的是钻石报价，听不到成片会是什么声音、多长。
 * 先逐段合成一遍，把时间轴摆出来，用户才可能在花钱之前发现「这句太长了」「这个音色不对」。
 *
 * <p><b>逐段的粒度是镜头（{@link ClipShotPlan#materialize}），不是原句</b>。理由是出片 worker
 * 的 tts 阶段就是按镜头合成的（见 {@link ClipRenderWorkerState}）：合并成一镜的几句话在成片里
 * 本来就是一条音频。预览若按原句切，用户听到的时间轴和最终成片对不上，那还不如不给。
 * 副作用是 {@code no} 与 §1.6 的段级状态同一套编号，两个接口可以直接对齐。
 *
 * <p><b>作废口径</b>：{@code timelineHash} = sha256(voiceId + 每镜的 no/role/文案)。
 * 文案改一个字、换一个音色、重新分镜，指纹都会变，旧结果当场失效（GET 报 404，POST 重算）。
 *
 * <p><b>不静默降级</b>：没有可用音色、供应商拒绝、拿不到可镜像的音频，一律落成
 * {@code status="failed"} + 明确 {@code errorCode}，绝不返回一个空 URL 装作成功。
 */
@Service
public class ClipTtsPreviewService {
    private static final Logger log = LoggerFactory.getLogger(ClipTtsPreviewService.class);

    /** 指纹分隔符。用不可打印字符，免得文案里的标点把「第 1 段结尾」和「第 2 段开头」拼成同一串。 */
    private static final char SEP = (char) 1;
    /** 单段试听文案上限。石榴 /speaker/tts 的硬上限是 10000，这里按成片单段的合理长度先收一道。 */
    private static final int MAX_SEGMENT_CHARS = 2000;

    private final ClipTtsPreviewRepository repo;
    private final ClipProjectService projects;
    private final ShiliuService shiliu;
    private final ClipAvatarService avatars;
    private final ClipOutputStorage outputStorage;
    private final FileStorageService storage;

    public ClipTtsPreviewService(ClipTtsPreviewRepository repo, ClipProjectService projects, ShiliuService shiliu,
                                 ClipAvatarService avatars, ClipOutputStorage outputStorage, FileStorageService storage) {
        this.repo = repo; this.projects = projects; this.shiliu = shiliu;
        this.avatars = avatars; this.outputStorage = outputStorage; this.storage = storage;
    }

    // ── 对外两个动作 ────────────────────────────────────────────────────────────

    /**
     * 触发生成。**幂等**：文案与音色没变（{@code timelineHash} 相同）且上一次不是 failed 时，
     * 直接返回已有结果，不重复调供应商。failed 会重新排一次 —— 失败通常是瞬时的，
     * 让用户再点一次就能重试，比逼他改一个字来换指纹要诚实。
     */
    @Transactional
    public TtsPreviewDto trigger(String owner, String projectId) {
        ClipProject project = projects.required(owner, projectId);
        Timeline timeline = timeline(project);
        ClipTtsPreview row = repo.findByExternalOwnerIdAndProjectId(owner, projectId).orElse(null);
        if (row != null && timeline.hash().equals(row.getTimelineHash()) && !"failed".equals(row.getStatus())) {
            return view(row);
        }
        Instant now = Instant.now();
        if (row == null) {
            row = ClipTtsPreview.builder().id("ctp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16))
                    .externalOwnerId(owner).projectId(projectId).timelineHash(timeline.hash()).createdAt(now).build();
        } else if (!timeline.hash().equals(row.getTimelineHash())) {
            // 换了一版文案：旧音频再也没人会引用，顺手清掉，别在对象存储里养孤儿。
            forEachAudioKey(row, outputStorage::deleteQuietly);
        }
        row.setTimelineHash(timeline.hash());
        row.setVoiceId(timeline.voiceId());
        row.setSegmentsJson(Map.of("items", timeline.rows()));
        row.setTotalDurationSec(0);
        row.setCredits(0);
        row.setErrorCode(null);
        row.setErrorMessage(null);
        row.setAttempts(0);
        row.setLeaseOwner(null);
        row.setLeaseUntil(null);
        row.setCompletedAt(null);
        row.setHeartbeatAt(now);
        row.setUpdatedAt(now);

        BusinessException blocker = blocker(owner, project, timeline);
        if (blocker != null) {
            row.setStatus("failed");
            row.setErrorCode(blocker.getCode());
            row.setErrorMessage(blocker.getMessage());
            row.setCompletedAt(now);
        } else {
            row.setStatus("generating");
        }
        return view(repo.save(row));
    }

    /**
     * 轮询。没有预览、或预览对应的是**旧一版文案**时一律 404 —— 让调用方去重新 POST，
     * 而不是拿着一份和当前文案对不上的时间轴去对齐字幕。
     */
    @Transactional(readOnly = true)
    public TtsPreviewDto view(String owner, String projectId) {
        ClipProject project = projects.required(owner, projectId);
        ClipTtsPreview row = repo.findByExternalOwnerIdAndProjectId(owner, projectId)
                .filter(v -> timeline(project).hash().equals(v.getTimelineHash()))
                .orElseThrow(() -> BusinessException.notFound("CLIP_TTS_PREVIEW_NOT_FOUND",
                        "还没有当前这版文案的配音预览"));
        return view(row);
    }

    // ── worker 侧 ──────────────────────────────────────────────────────────────

    @Transactional
    public int acquire(String id, String workerId) {
        Instant now = Instant.now();
        return repo.acquire(id, workerId, now.plusSeconds(180), now);
    }

    /** 每轮只推进一段：事务短、失败面小，和出片 worker 同一套节奏。 */
    @Transactional
    public void advance(String id, String workerId) {
        ClipTtsPreview row = repo.findById(id).orElse(null);
        if (row == null || !"generating".equals(row.getStatus()) || !workerId.equals(row.getLeaseOwner())) return;
        Instant now = Instant.now();
        row.setHeartbeatAt(now);
        row.setUpdatedAt(now);

        ClipProject project = projects.required(row.getExternalOwnerId(), row.getProjectId());
        Timeline timeline = timeline(project);
        if (!timeline.hash().equals(row.getTimelineHash())) {
            // 生成途中用户又改了文案。这一版已经没有意义了，就地判死，别继续烧点数。
            markFailed(row, "CLIP_TTS_PREVIEW_STALE", "文案已变更，请重新生成配音预览", now);
            repo.save(row);
            return;
        }

        List<Map<String, Object>> items = items(row);
        Map<String, Object> pending = items.stream()
                .filter(item -> !"tail".equals(String.valueOf(item.get("role"))))
                .filter(item -> text(item.get("audioCdnKey")).isBlank())
                .findFirst().orElse(null);
        if (pending == null) {
            row.setTotalDurationSec(totalDuration(items));
            row.setStatus("ready");
            row.setCompletedAt(now);
            row.setLeaseOwner(null);
            row.setLeaseUntil(null);
            repo.save(row);
            log.info("[clip-tts-preview] ready project={} segments={} totalSec={}",
                    row.getProjectId(), items.size(), row.getTotalDurationSec());
            return;
        }

        row.setAttempts(row.getAttempts() + 1);
        ShiliuGateway gateway = shiliu.required();
        String voiceRef = avatars.requiredVoiceEngineRef(row.getExternalOwnerId(),
                ClipDtos.string(project.getPayloadJson().get("avatarId")), row.getVoiceId());
        Map<String, Object> source = segmentByNo(timeline.segments(), number(pending.get("no")));
        String script = text(source.get("text"));
        ShiliuGateway.Task task = gateway.previewVoice(row.getExternalOwnerId(), voiceRef, script);
        if (!"succeeded".equals(task.status())) {
            throw new BusinessException(HttpStatus.BAD_GATEWAY, "CLIP_TTS_FAILED",
                    "配音试听合成失败" + (task.error() == null ? "" : "：" + task.error()));
        }
        double duration = task.durationSec() == null
                ? Math.max(1, ClipProjectService.seconds(source)) : task.durationSec();
        pending.put("audioCdnKey", audioKey(gateway, row.getExternalOwnerId(), task, (int) Math.ceil(duration)));
        pending.put("actualDurationSec", duration);
        row.setSegmentsJson(Map.of("items", items));
        row.setTotalDurationSec(totalDuration(items));
        row.setLeaseOwner(null);
        row.setLeaseUntil(null);
        repo.save(row);
    }

    /** 失败落地。**独立事务**：advance 抛异常会回滚，失败原因不能跟着一起被回滚掉。 */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void fail(String id, String errorCode, String message) {
        ClipTtsPreview row = repo.findById(id).orElse(null);
        if (row == null || !"generating".equals(row.getStatus())) return;
        markFailed(row, errorCode, message, Instant.now());
        repo.save(row);
    }

    /** 项目彻底删除时一并清掉预览音频。调用方是 {@link ClipProjectService}（它只删行，不懂对象存储）。 */
    public void purgeProject(String projectId) {
        for (ClipTtsPreview row : repo.findByProjectId(projectId)) forEachAudioKey(row, outputStorage::deleteQuietly);
    }

    // ── 内部 ───────────────────────────────────────────────────────────────────

    /** 一版文案的投影：镜头列表 + 指纹 + 当时的音色。 */
    record Timeline(String hash, String voiceId, List<Map<String, Object>> segments, List<Map<String, Object>> rows) {}

    Timeline timeline(ClipProject project) {
        String voiceId = ClipDtos.string(project.getPayloadJson().get("voiceId"));
        List<Map<String, Object>> segments = ClipShotPlan.materialize(project.getPayloadJson());
        StringBuilder canonical = new StringBuilder(voiceId == null ? "" : voiceId);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> segment : segments) {
            int no = number(segment.get("no"));
            String role = String.valueOf(segment.get("role"));
            canonical.append('\n').append(no).append(SEP).append(role).append(SEP).append(text(segment.get("text")));
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("no", no);
            row.put("role", role);
            row.put("estimateDurationSec", ClipProjectService.seconds(segment));
            rows.add(row);
        }
        return new Timeline("sha256:" + sha256(canonical.toString()), voiceId, segments, rows);
    }

    /**
     * 开工前就能判死的原因。这里返回而不是抛，是因为 §1.5 要的是
     * {@code status="failed" + errorCode}，不是一个 4xx —— 调用方拿到的仍是一份预览对象。
     */
    private BusinessException blocker(String owner, ClipProject project, Timeline timeline) {
        List<Map<String, Object>> speech = timeline.segments().stream()
                .filter(row -> !"tail".equals(String.valueOf(row.get("role")))).toList();
        if (speech.isEmpty()) return BusinessException.badRequest("CLIP_NO_SEGMENTS", "文案还是空的");
        for (Map<String, Object> row : speech) {
            String script = text(row.get("text"));
            if (script.isBlank()) return BusinessException.badRequest("CLIP_EMPTY_TEXT", "文案中还有空句");
            if (script.length() > MAX_SEGMENT_CHARS) {
                return BusinessException.badRequest("CLIP_SEGMENT_TOO_LONG", "单段文案过长，先拆短再试听");
            }
        }
        try {
            shiliu.required();
            avatars.requiredVoiceEngineRef(owner, ClipDtos.string(project.getPayloadJson().get("avatarId")), timeline.voiceId());
            return null;
        } catch (BusinessException e) {
            return e;
        }
    }

    /**
     * 拿到一段音频在我方存储里的 key。三条来源按可信度排：
     * <ol>
     *   <li>网关已经镜像好了（HTTP 网关的 /speaker/tts 就是这样，直接给 key）；</li>
     *   <li>只给了公网 HTTPS 时效地址 → 立刻转存，绝不把它写进结果；</li>
     *   <li>force-mock 的确定性测试媒体 → 就地生成一段等长静音 WAV。</li>
     * </ol>
     * 生产网关走不到第 3 条：那里拿不到可镜像的音频就是失败，不许拿静音冒充成品。
     */
    private String audioKey(ShiliuGateway gateway, String owner, ShiliuGateway.Task task, int durationSec) {
        String mirrored = task.outputCdnKey() == null ? "" : task.outputCdnKey().trim();
        if (!mirrored.isBlank()) return mirrored;
        String remote = task.outputRef() == null ? "" : task.outputRef().trim();
        if (remote.startsWith("https://")) return outputStorage.persistAudio(owner, remote);
        if (gateway.mock()) {
            return storage.store(silentWav(durationSec), "clip/tts-preview", owner, "wav", "audio/wav").key();
        }
        throw new BusinessException(HttpStatus.BAD_GATEWAY, "CLIP_TTS_FAILED", "配音试听没有返回可用音频");
    }

    private void markFailed(ClipTtsPreview row, String errorCode, String message, Instant now) {
        row.setStatus("failed");
        row.setErrorCode(errorCode == null || errorCode.isBlank() ? "CLIP_TTS_FAILED" : errorCode);
        row.setErrorMessage(message == null || message.isBlank() ? "配音预览生成失败" : message);
        row.setCompletedAt(now);
        row.setUpdatedAt(now);
        row.setLeaseOwner(null);
        row.setLeaseUntil(null);
    }

    /** 出 wire：key → 短期签名 URL，{@code startSec} 按 durationSec 现算累加，不落库以免和段时长漂移。 */
    private TtsPreviewDto view(ClipTtsPreview row) {
        List<TtsPreviewSegmentDto> segments = new ArrayList<>();
        double cursor = 0;
        for (Map<String, Object> item : items(row)) {
            double duration = duration(item);
            String key = text(item.get("audioCdnKey"));
            segments.add(new TtsPreviewSegmentDto(number(item.get("no")),
                    key.isBlank() ? null : storage.signedUrl(key), round(duration), round(cursor)));
            cursor += duration;
        }
        return new TtsPreviewDto(row.getStatus(), row.getTimelineHash(), row.getVoiceId(), round(cursor),
                segments, row.getErrorCode(), row.getErrorMessage(), row.getCredits());
    }

    private static List<Map<String, Object>> items(ClipTtsPreview row) {
        return ClipDtos.mapListValue(ClipDtos.safeMap(row.getSegmentsJson()).get("items"));
    }
    private static void forEachAudioKey(ClipTtsPreview row, java.util.function.Consumer<String> action) {
        for (Map<String, Object> item : items(row)) {
            String key = text(item.get("audioCdnKey"));
            if (!key.isBlank()) action.accept(key);
        }
    }
    private static double totalDuration(List<Map<String, Object>> items) {
        return round(items.stream().mapToDouble(ClipTtsPreviewService::duration).sum());
    }
    /** 已合成的用真实时长，没合成的先用估算 —— 生成过程中时间轴也得能用，不能是一排 0。 */
    private static double duration(Map<String, Object> item) {
        Object actual = item.get("actualDurationSec");
        if (actual instanceof Number n && n.doubleValue() > 0) return n.doubleValue();
        Object estimate = item.get("estimateDurationSec");
        return estimate instanceof Number n ? Math.max(0, n.doubleValue()) : 0;
    }
    private static Map<String, Object> segmentByNo(List<Map<String, Object>> segments, int no) {
        return segments.stream().filter(row -> number(row.get("no")) == no).findFirst()
                .orElseThrow(() -> new IllegalStateException("镜头 " + no + " 在当前文案里已不存在"));
    }
    private static double round(double value) { return Math.round(value * 10d) / 10d; }
    private static int number(Object value) { return value instanceof Number n ? n.intValue() : -1; }
    private static String text(Object value) { return value == null ? "" : String.valueOf(value).trim(); }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(digest.length * 2);
            for (byte b : digest) hex.append(Character.forDigit((b >> 4) & 0xF, 16)).append(Character.forDigit(b & 0xF, 16));
            return hex.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** 8kHz / 16bit / 单声道的等长静音 WAV。只在 force-mock 下用，给端上一个真的能播、时长准确的占位。 */
    public static byte[] silentWav(int seconds) {
        int rate = 8000, channels = 1, bits = 16;
        int dataLen = rate * channels * (bits / 8) * Math.max(1, Math.min(600, seconds));
        ByteBuffer buffer = ByteBuffer.allocate(44 + dataLen).order(ByteOrder.LITTLE_ENDIAN);
        buffer.put("RIFF".getBytes(StandardCharsets.US_ASCII)).putInt(36 + dataLen).put("WAVE".getBytes(StandardCharsets.US_ASCII));
        buffer.put("fmt ".getBytes(StandardCharsets.US_ASCII)).putInt(16).putShort((short) 1).putShort((short) channels);
        buffer.putInt(rate).putInt(rate * channels * bits / 8).putShort((short) (channels * bits / 8)).putShort((short) bits);
        buffer.put("data".getBytes(StandardCharsets.US_ASCII)).putInt(dataLen);
        return buffer.array();
    }
}
