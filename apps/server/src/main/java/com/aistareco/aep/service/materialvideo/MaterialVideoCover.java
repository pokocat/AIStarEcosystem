package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * 成片封面（v0.199.1）：厂商没给封面时，从已经在本机的成片里截一帧，传到我方存储当封面。
 *
 * <p>聚算 MiniMax H3 的任务结果里只有视频资产、没有封面（2026-10-03 线上真厂商实测，四种模式都是），
 * 于是 {@code thumbnailUrl} 一直是空的：作品卡片靠播放器自己画第一帧还看得过去，模板卡片却只剩黑底加播放钮。
 * 线上那次 mock 端到端没发现这个，是因为 mock 出片自带封面。
 *
 * <p>best-effort：截不出来 / 传不上就返回 null，绝不影响出片和结算。封面只管展示，缺了是卡片没图，
 * 不是交付了假东西（AGENTS.md §8.0 的观测类例外）。
 */
@Component
public class MaterialVideoCover {

    private static final Logger log = LoggerFactory.getLogger(MaterialVideoCover.class);

    /** 截 0.5 秒处那一帧（开头常是黑场 / 淡入），同 clip 的素材缩略图；不到 0.5 秒的片退回第 0 秒。 */
    static final String SEEK_SECONDS = "0.5";

    /**
     * 截一帧的超时。正常 1 秒内完成；不用全局的渲染超时（生产 10 分钟），因为这一步跑在出片线程上
     * （全平台共 3 个），卡住就是任务一直显示「生成中」、线程被占着。
     */
    static final long GRAB_TIMEOUT_MS = 30_000L;

    private final FfmpegRunner ffmpeg;
    private final CdnUploader cdn;

    public MaterialVideoCover(FfmpegRunner ffmpeg, ObjectProvider<CdnUploader> cdnProvider) {
        this.ffmpeg = ffmpeg;
        this.cdn = cdnProvider.getIfAvailable();
    }

    /** 封面在存储里的位置：和镜像厂商封面放在同一处（厂商的按原扩展名存，截的固定是 .jpg）。 */
    static String coverKey(String jobId) {
        return "material-videos/" + jobId + "/thumbnail.jpg";
    }

    /**
     * 从本机成片截一帧传到我方存储，返回存储给的地址（与成片地址同一种形态，出 wire 时再签名）。
     * 截不出 / 传不上 / 没配存储 → null（已打 WARN）。
     */
    public String extractAndUpload(String jobId, Path video) {
        if (cdn == null) return null;
        Path jpg = null;
        try {
            jpg = Files.createTempFile("material-video-cover-" + jobId + "-", ".jpg");
            Grab grabbed = grab(video, jpg, SEEK_SECONDS);
            // 截不到就退回第 0 秒再截一次：不到 0.5 秒的片，2018 版 ffmpeg（线上）正常退出、一帧不写，
            // 8.x 直接报错退出，两种都要退。超时或线程被打断就不再试了：再试一次多半一样慢，白占出片线程。
            if (grabbed.problem() != null && !grabbed.timedOut() && !Thread.currentThread().isInterrupted()) {
                grabbed = grab(video, jpg, "0");
            }
            if (grabbed.problem() != null) {
                log.warn("[material-video] job {} cover: no frame could be read from the video ({})",
                        jobId, grabbed.problem());
                return null;
            }
            long bytes = Files.size(jpg);
            String url = cdn.upload(jpg, coverKey(jobId), "image/jpeg").cdnUrl();
            log.info("[material-video] job {} cover taken from the video ({} bytes)", jobId, bytes);
            return url;
        } catch (Exception e) {
            log.warn("[material-video] job {} cover extraction failed: {}", jobId, e.toString());
            return null;
        } finally {
            if (jpg != null) {
                try { Files.deleteIfExists(jpg); } catch (Exception ignore) { /* best-effort cleanup */ }
            }
        }
    }

    /** 一次截帧的结果：{@code problem == null} 是截到了；{@code timedOut} 是 ffmpeg 超过 {@link #GRAB_TIMEOUT_MS} 被杀掉。 */
    private record Grab(String problem, boolean timedOut) {}

    /** 在 {@code seek} 秒处截一帧到 {@code out}：宽不超过 720、不放大，高按比例。 */
    private Grab grab(Path video, Path out, String seek) {
        try {
            ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-ss", seek, "-i", video.toString(), "-frames:v", "1",
                    "-vf", "scale='min(720,iw)':-2", "-q:v", "3", out.toString()), GRAB_TIMEOUT_MS);
            return Files.exists(out) && Files.size(out) > 0
                    ? new Grab(null, false)
                    : new Grab("no frame at " + seek + "s", false);
        } catch (Exception e) {
            String msg = e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage();
            return new Grab(msg.length() > 300 ? msg.substring(msg.length() - 300) : msg,
                    e instanceof FfmpegRunner.TimedOutException);
        }
    }
}
