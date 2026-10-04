package com.aistareco.aep.service.materialvideo;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.ObjectProvider;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * v0.199.1 成片封面：本机有 ffmpeg 就真截一帧（没有就跳过），存储用一个记账的假实现。
 * 成片尺寸照 2026-10-03 线上真厂商实测：768p 16:9 = 1344×768、544p 9:16 = 544×960。
 */
class MaterialVideoCoverTest {

    private final FfmpegRunner ffmpeg = new FfmpegRunner(new MixcutProperties());

    /** 记下传上去的每个文件（key → 内容）。 */
    private static final class Recorder implements CdnUploader {
        final Map<String, byte[]> files = new ConcurrentHashMap<>();

        @Override
        public CdnUploadResult upload(Path localFile, String key, String contentType) throws IOException {
            byte[] bytes = Files.readAllBytes(localFile);
            files.put(key, bytes);
            return new CdnUploadResult("https://cdn.test/" + key, key, bytes.length, Instant.now());
        }

        @Override
        public void delete(String key) { files.remove(key); }

        @Override
        public String publicUrlFor(String key) { return "https://cdn.test/" + key; }

        @Override
        public String driverName() { return "recorder"; }
    }

    private MaterialVideoCover cover(CdnUploader uploader) {
        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(uploader);
        return new MaterialVideoCover(ffmpeg, provider);
    }

    private boolean ffmpegAvailable() {
        try {
            ffmpeg.runFfmpeg(List.of("-version"));
            ffmpeg.runFfprobe(List.of("-version"));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private Path video(Path dir, String name, String size, String seconds) {
        Path out = dir.resolve(name);
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi",
                "-i", "testsrc=size=" + size + ":rate=24:duration=" + seconds,
                "-c:v", "libx264", "-pix_fmt", "yuv420p", out.toString()));
        return out;
    }

    /** 传上去的封面：是 JPEG，返回它的宽高。 */
    private int[] storedJpeg(Path dir, Recorder up, String jobId) throws IOException {
        byte[] jpeg = up.files.get("material-videos/" + jobId + "/thumbnail.jpg");
        assertNotNull(jpeg, "封面没传到 material-videos/" + jobId + "/thumbnail.jpg：" + up.files.keySet());
        assertTrue(jpeg.length > 2 && (jpeg[0] & 0xff) == 0xff && (jpeg[1] & 0xff) == 0xd8, "不是 JPEG");
        Path f = dir.resolve(jobId + "-cover.jpg");
        Files.write(f, jpeg);
        FfmpegRunner.MediaProbe probe = ffmpeg.probeMedia(f.toFile());
        return new int[]{probe.width(), probe.height()};
    }

    @Test
    void landscape768pVideo_coverIs720WideAndKeepsTheShape(@TempDir Path dir) throws Exception {
        assumeTrue(ffmpegAvailable(), "本机没有 ffmpeg / ffprobe");
        Recorder up = new Recorder();

        String url = cover(up).extractAndUpload("mvj_land", video(dir, "land.mp4", "1344x768", "2"));

        assertEquals("https://cdn.test/material-videos/mvj_land/thumbnail.jpg", url);
        int[] wh = storedJpeg(dir, up, "mvj_land");
        assertEquals(720, wh[0]);
        assertEquals(0, wh[1] % 2, "高要是偶数");
        assertTrue(Math.abs(wh[1] - 720.0 * 768 / 1344) <= 2, "高 " + wh[1] + " 没按比例");
    }

    @Test
    void portrait544pVideo_isNotUpscaled(@TempDir Path dir) throws Exception {
        assumeTrue(ffmpegAvailable(), "本机没有 ffmpeg / ffprobe");
        Recorder up = new Recorder();

        assertNotNull(cover(up).extractAndUpload("mvj_port", video(dir, "port.mp4", "544x960", "2")));

        int[] wh = storedJpeg(dir, up, "mvj_port");
        assertEquals(544, wh[0]);
        assertEquals(960, wh[1]);
    }

    @Test
    void clipShorterThanTheSeekPoint_fallsBackToTheFirstFrame(@TempDir Path dir) throws Exception {
        assumeTrue(ffmpegAvailable(), "本机没有 ffmpeg / ffprobe");
        Recorder up = new Recorder();

        assertNotNull(cover(up).extractAndUpload("mvj_short", video(dir, "short.mp4", "320x240", "0.2")));

        int[] wh = storedJpeg(dir, up, "mvj_short");
        assertEquals(320, wh[0]);
        assertEquals(240, wh[1]);
    }

    @Test
    void fileThatIsNotAVideo_givesNoCoverAndUploadsNothing(@TempDir Path dir) throws Exception {
        assumeTrue(ffmpegAvailable(), "本机没有 ffmpeg / ffprobe");
        Recorder up = new Recorder();
        Path junk = dir.resolve("junk.mp4");
        Files.write(junk, new byte[]{1, 2, 3, 4});

        assertNull(cover(up).extractAndUpload("mvj_junk", junk));
        assertTrue(up.files.isEmpty());
    }

    @Test
    void grab_usesItsOwnShortTimeout_notTheGlobalRenderTimeout(@TempDir Path dir) throws Exception {
        // 截帧跑在出片线程上（全平台 3 个），卡住不能等生产那 10 分钟的渲染超时
        FfmpegRunner stub = mock(FfmpegRunner.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(new Recorder());
        Path any = dir.resolve("v.mp4");
        Files.write(any, new byte[]{1});

        assertNull(new MaterialVideoCover(stub, provider).extractAndUpload("mvj_t", any));

        verify(stub, org.mockito.Mockito.times(2)).runFfmpeg(anyList(), eq(MaterialVideoCover.GRAB_TIMEOUT_MS));
        assertEquals(30_000L, MaterialVideoCover.GRAB_TIMEOUT_MS);
    }

    @Test
    void ordinaryError_isRetriedOnceAtTheFirstFrame(@TempDir Path dir) throws Exception {
        // 8.x 的 ffmpeg 对超出时长的 -ss 直接报错退出（2018 版是正常退出、一帧不写），两种都要退回第 0 秒
        FfmpegRunner stub = mock(FfmpegRunner.class);
        when(stub.runFfmpeg(anyList(), eq(MaterialVideoCover.GRAB_TIMEOUT_MS)))
                .thenThrow(new RuntimeException("ffmpeg exit=234 bin=ffmpeg tail=Output file is empty"));
        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(new Recorder());
        Path any = dir.resolve("v.mp4");
        Files.write(any, new byte[]{1});

        assertNull(new MaterialVideoCover(stub, provider).extractAndUpload("mvj_t", any));

        verify(stub, org.mockito.Mockito.times(2)).runFfmpeg(anyList(), eq(MaterialVideoCover.GRAB_TIMEOUT_MS));
    }

    @Test
    void timeout_isNotRetried(@TempDir Path dir) throws Exception {
        // 超时再试一次多半一样慢，白占出片线程（全平台 3 个）
        FfmpegRunner stub = mock(FfmpegRunner.class);
        when(stub.runFfmpeg(anyList(), eq(MaterialVideoCover.GRAB_TIMEOUT_MS)))
                .thenThrow(new FfmpegRunner.TimedOutException("ffmpeg timed out after 30000ms (limit=30000ms)"));
        @SuppressWarnings("unchecked")
        ObjectProvider<CdnUploader> provider = mock(ObjectProvider.class);
        Recorder up = new Recorder();
        when(provider.getIfAvailable()).thenReturn(up);
        Path any = dir.resolve("v.mp4");
        Files.write(any, new byte[]{1});

        assertNull(new MaterialVideoCover(stub, provider).extractAndUpload("mvj_t", any));

        verify(stub, org.mockito.Mockito.times(1)).runFfmpeg(anyList(), eq(MaterialVideoCover.GRAB_TIMEOUT_MS));
        assertTrue(up.files.isEmpty());
    }

    @Test
    void ffmpegTimeoutOverload_cutsALongRunAtTheGivenLimit() {
        assumeTrue(ffmpegAvailable(), "本机没有 ffmpeg / ffprobe");
        long t0 = System.nanoTime();
        RuntimeException e = assertThrows(FfmpegRunner.TimedOutException.class, () -> ffmpeg.runFfmpeg(List.of("-v", "error",
                "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=24:duration=600", "-f", "null", "-"), 300L));
        long ms = (System.nanoTime() - t0) / 1_000_000L;
        assertTrue(e.getMessage().contains("limit=300ms"), e.getMessage());
        assertTrue(ms < 10_000, "超时没按传入的值生效，跑了 " + ms + "ms");
    }

    @Test
    void withoutStorage_givesNoCover(@TempDir Path dir) throws Exception {
        Path any = dir.resolve("v.mp4");
        Files.write(any, new byte[]{1});

        assertNull(cover(null).extractAndUpload("mvj_nostore", any));
    }
}
