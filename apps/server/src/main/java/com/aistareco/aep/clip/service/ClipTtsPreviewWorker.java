package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.model.ClipTtsPreview;
import com.aistareco.aep.clip.repository.ClipTtsPreviewRepository;
import com.aistareco.common.BusinessException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 逐段推进配音预览。与出片 worker 分开，是因为两者抢的东西不同：
 * 出片是用户已经付过钱、在等成片的任务，预览只是花供应商点数的试听。
 * 合在一起的话，一个人狂点试听就能把正在出片的人堵在队尾。
 */
@Component
public class ClipTtsPreviewWorker {
    private static final Logger log = LoggerFactory.getLogger(ClipTtsPreviewWorker.class);
    private final String workerId = "clip-tts-preview-" + UUID.randomUUID().toString().substring(0, 8);

    private final ClipTtsPreviewRepository repo;
    private final ClipTtsPreviewService previews;
    private final ClipProperties props;

    public ClipTtsPreviewWorker(ClipTtsPreviewRepository repo, ClipTtsPreviewService previews, ClipProperties props) {
        this.repo = repo; this.previews = previews; this.props = props;
    }

    @Scheduled(fixedDelayString = "${aep.clip.tts-preview-delay-ms:2000}")
    public void tick() {
        for (ClipTtsPreview row : repo.findTop20ByStatusOrderByCreatedAtAsc("generating")) {
            try {
                if (previews.acquire(row.getId(), workerId) == 0) continue;
                previews.advance(row.getId(), workerId);
            } catch (Exception e) {
                // 失败一次就判死，不重试：TTS 的失败几乎都是稳定失败（没音色、点数用尽、文案违规），
                // 重试只会重复烧点数。用户再点一次触发就是一次显式重试。
                previews.fail(row.getId(), errorCode(e), message(e));
                log.warn("[clip-tts-preview] project={} 生成失败 code={}", row.getProjectId(), errorCode(e));
            }
        }
    }

    /** 重启/崩溃后非终态不会永久卡住 —— 端上轮询得到的必须是一个终态，不能是永远的 generating。 */
    @Scheduled(fixedDelayString = "${aep.clip.tts-preview-reaper-delay-ms:60000}")
    public void reap() {
        Instant cutoff = Instant.now().minusMillis(Math.max(60_000, props.getStaleMs()));
        for (ClipTtsPreview row : repo.findTop100ByStatusInAndHeartbeatAtBefore(List.of("generating"), cutoff)) {
            previews.fail(row.getId(), "CLIP_TTS_PREVIEW_TIMEOUT", "配音预览长时间没有进展，已自动终止");
        }
    }

    private static String errorCode(Exception e) {
        return e instanceof BusinessException be && be.getCode() != null && !be.getCode().isBlank()
                ? be.getCode() : "CLIP_TTS_FAILED";
    }

    /** 只带脱敏后的业务文案；供应商原始响应与签名地址一律不进日志、也不出 wire。 */
    private static String message(Exception e) {
        if (e instanceof BusinessException be) return be.getMessage();
        return "配音预览生成失败";
    }
}
