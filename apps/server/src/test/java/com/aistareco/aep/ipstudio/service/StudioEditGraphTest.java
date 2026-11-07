package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditCaption;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditMedia;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditOverlay;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditText;
import com.aistareco.aep.ipstudio.dto.StudioWorkflowDtos.EditTimeline;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.service.DramaAssembleService;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.picgen.FontRegistry;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.common.BusinessException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.test.util.ReflectionTestUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** 成片高级编辑（2026-10-19）：时间线校验、主轨排布，以及用真 ffmpeg 跑通整条合成。 */
class StudioEditGraphTest {
    private static EditMedia clip(String key, double start, double end) { return new EditMedia(key, start, end, 0.0, 1.0); }
    private static EditTimeline timeline(List<EditMedia> clips) { return new EditTimeline(720, 1280, clips, List.of(), List.of(), List.of()); }
    private static String code(Runnable r) { return assertThrows(BusinessException.class, r::run).getCode(); }

    @Test void rejectsTimelinesTheRendererCannotHonour() {
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(timeline(List.of()))));
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(timeline(List.of(clip("k", 3, 3))))));
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(new EditTimeline(721, 1280, List.of(clip("k", 0, 3)), null, null, null))));
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(timeline(List.of(new EditMedia("k", 0.0, 3.0, 0.0, 3.0))))));
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(timeline(List.of(clip("k", 0, 601))))));
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(new EditTimeline(720, 1280, List.of(clip("k", 0, 3)), null,
                List.of(new EditText("字", 0.0, 1.0, 0.0, 0.0, 48, "red")), null))));
        StudioEditGraph.validate(new EditTimeline(720, 1280, List.of(clip("k", 0, 3)), List.of(new EditMedia("v", 0.0, 2.0, 0.0, 1.0)),
                List.of(new EditText("限时优惠", 0.0, 1.0, 0.0, -300.0, 48, "#ffd400")), List.of(new EditCaption("第一句", 0.0, 1.0))));
    }

    @Test void mainTrackIsSortedAndALaterClipCutsTheEarlierOneShort() {
        var seq = StudioEditGraph.sequence(List.of(clip("b", 4, 8), clip("a", 0, 5), clip("c", 8, 8.0001)));
        assertEquals(List.of("a", "b"), seq.stream().map(EditMedia::storageKey).toList());
        assertEquals(4.0, seq.get(0).end());
        assertEquals(8.0, seq.get(1).end());
    }

    /** 真 ffmpeg：两段视频中间留 1 秒空隙、一条配音、一段文字、一条字幕，经 renderStudioEdit 合成并检查结果。 */
    @Test void rendersTheEditorTimelineWithRealFfmpeg(@TempDir Path dir) throws Exception {
        var ffmpeg = new FfmpegRunner(new MixcutProperties());
        Path a = dir.resolve("a.mp4"), b = dir.resolve("b.mp4"), voice = dir.resolve("voice.m4a");
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:size=720x1280:rate=24:duration=3", "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", a.toString()));
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:size=1280x720:rate=24:duration=2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", b.toString()));
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=880:duration=4", "-c:a", "aac", voice.toString()));

        HttpServer http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", ex -> {
            String name = ex.getRequestURI().getPath().replaceAll(".*/", "");
            byte[] body = Files.readAllBytes(dir.resolve(name));
            ex.sendResponseHeaders(200, body.length); ex.getResponseBody().write(body); ex.close();
        });
        http.start();
        try {
            CdnUrlSigner signer = mock(CdnUrlSigner.class);
            when(signer.signKey(anyString())).thenAnswer(inv -> "/cdn/" + inv.getArgument(0));
            CdnUploader uploader = mock(CdnUploader.class);
            Path[] uploaded = new Path[1];
            when(uploader.upload(any(Path.class), anyString(), anyString())).thenAnswer(inv -> {
                uploaded[0] = dir.resolve("out.mp4"); Files.copy((Path) inv.getArgument(0), uploaded[0]);
                return new CdnUploader.CdnUploadResult("/cdn/x", inv.getArgument(1), Files.size(uploaded[0]), Instant.now());
            });
            var fonts = new FontRegistry(); fonts.load();
            var svc = new DramaAssembleService(mock(DramaProjectRepository.class), ffmpeg, uploader, signer, mock(StorageQuotaService.class),
                    new ObjectMapper(), http.getAddress().getPort(), "/cdn", "");
            ReflectionTestUtils.setField(svc, "studioPackaging", new StudioPackagingService(ffmpeg, fonts));

            var edit = new EditTimeline(720, 1280,
                    List.of(new EditMedia("a.mp4", 0.0, 2.5, 0.5, 1.0), new EditMedia("b.mp4", 3.5, 5.5, 0.0, 1.0)),
                    List.of(new EditMedia("voice.m4a", 1.0, 5.0, 0.0, 0.8)),
                    List.of(new EditText("限时优惠", 0.0, 2.0, 0.0, -400.0, 72, "#FFD400")),
                    List.of(new EditCaption("这是第一句字幕", 3.6, 5.4)));
            var result = svc.renderStudioEdit("u1", "IPP-1", edit);
            assertTrue(result.key().startsWith("ipstudio_gen/"), result.key());

            var probe = ffmpeg.probeMedia(uploaded[0].toFile());
            assertEquals(5.5, probe.durationSec(), 0.15);
            assertEquals(720, probe.width()); assertEquals(1280, probe.height());
            assertTrue(probe.hasAudio(), "voice and clip audio are mixed in");
            assertTrue(brightness(ffmpeg, uploaded[0], dir, 3.0) < 8, "the gap between clips is black");
            assertTrue(redness(ffmpeg, uploaded[0], dir, 1.0) > 150, "the first clip shows from its in-point");
            assertTrue(changedAround(ffmpeg, uploaded[0], dir, 1.0, 2.4, 300, 260), "the text is visible only while it is on");
        } finally {
            http.stop(0);
        }
    }

    /** 编辑室导出也要带上一键成片选的背景音乐（2026-11-07 复评发现：之前只要进过编辑室，音乐就悄悄丢了）。片段本身没声音时，成片里听到的就是音乐。 */
    @Test void backgroundMusicGoesThroughTheWholeRender(@TempDir Path dir) throws Exception {
        var ffmpeg = new FfmpegRunner(new MixcutProperties());
        Path a = dir.resolve("a.mp4"), song = dir.resolve("song.m4a");
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:size=720x1280:rate=30:duration=3", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", a.toString()));
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:a", "aac", song.toString()));
        HttpServer http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", ex -> {
            byte[] body = Files.readAllBytes(dir.resolve(ex.getRequestURI().getPath().replaceAll(".*/", "")));
            ex.sendResponseHeaders(200, body.length); ex.getResponseBody().write(body); ex.close();
        });
        http.start();
        try {
            CdnUrlSigner signer = mock(CdnUrlSigner.class);
            when(signer.signKey(anyString())).thenAnswer(inv -> "/cdn/" + inv.getArgument(0));
            CdnUploader uploader = mock(CdnUploader.class);
            Path uploaded = dir.resolve("whole.mp4");
            when(uploader.upload(any(Path.class), anyString(), anyString())).thenAnswer(inv -> {
                Files.copy((Path) inv.getArgument(0), uploaded);
                return new CdnUploader.CdnUploadResult("/cdn/x", inv.getArgument(1), Files.size(uploaded), Instant.now());
            });
            var fonts = new FontRegistry(); fonts.load();
            var svc = new DramaAssembleService(mock(DramaProjectRepository.class), ffmpeg, uploader, signer, mock(StorageQuotaService.class),
                    new ObjectMapper(), http.getAddress().getPort(), "/cdn", "");
            ReflectionTestUtils.setField(svc, "studioPackaging", new StudioPackagingService(ffmpeg, fonts));
            var result = svc.renderStudioEdit("u1", "IPP-1", new EditTimeline(720, 1280, List.of(new EditMedia("a.mp4", 0.0, 3.0, 0.0, 1.0)), List.of(), List.of(), List.of(), null, null, "song.m4a"));
            assertEquals(3, result.durationSec());
            String log = ffmpeg.runFfmpeg(List.of("-hide_banner", "-nostats", "-i", uploaded.toString(), "-af", "volumedetect", "-f", "null", "-"));
            var mean = java.util.regex.Pattern.compile("mean_volume: (-?[0-9.]+) dB").matcher(log);
            assertTrue(mean.find(), log);
            assertTrue(Double.parseDouble(mean.group(1)) > -50, "成片里听得到音乐：" + mean.group(1));
        } finally {
            http.stop(0);
        }
    }

    /** 走 renderStudioEdit 整条路：图片没有时长，不能被当成读不出来的素材（2026-11-07 浏览器走查时撞到）。 */
    @Test void anImageOverlayGoesThroughTheWholeRender(@TempDir Path dir) throws Exception {
        var ffmpeg = new FfmpegRunner(new MixcutProperties());
        Path a = dir.resolve("a.mp4"), image = dir.resolve("g.png");
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:size=720x1280:rate=30:duration=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", a.toString()));
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=yellow:size=64x64", "-frames:v", "1", image.toString()));
        HttpServer http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", ex -> {
            byte[] body = Files.readAllBytes(dir.resolve(ex.getRequestURI().getPath().replaceAll(".*/", "")));
            ex.sendResponseHeaders(200, body.length); ex.getResponseBody().write(body); ex.close();
        });
        http.start();
        try {
            CdnUrlSigner signer = mock(CdnUrlSigner.class);
            when(signer.signKey(anyString())).thenAnswer(inv -> "/cdn/" + inv.getArgument(0));
            CdnUploader uploader = mock(CdnUploader.class);
            Path uploaded = dir.resolve("whole.mp4");
            when(uploader.upload(any(Path.class), anyString(), anyString())).thenAnswer(inv -> {
                Files.copy((Path) inv.getArgument(0), uploaded);
                return new CdnUploader.CdnUploadResult("/cdn/x", inv.getArgument(1), Files.size(uploaded), Instant.now());
            });
            var fonts = new FontRegistry(); fonts.load();
            var svc = new DramaAssembleService(mock(DramaProjectRepository.class), ffmpeg, uploader, signer, mock(StorageQuotaService.class),
                    new ObjectMapper(), http.getAddress().getPort(), "/cdn", "");
            ReflectionTestUtils.setField(svc, "studioPackaging", new StudioPackagingService(ffmpeg, fonts));
            svc.renderStudioEdit("u1", "IPP-1", new EditTimeline(720, 1280, List.of(new EditMedia("a.mp4", 0.0, 2.0, 0.0, 1.0)), List.of(), List.of(), List.of(),
                    List.of(new EditOverlay("image", "g.png", 0.0, 2.0, null, 0.0, 0.0, 100.0, 100.0, null, null)), null));
            int pixel = frame(ffmpeg, uploaded, dir, 1.0).getRGB(360, 640);
            assertTrue(((pixel >> 8) & 255) > 180, "图片叠在画面中央");
        } finally {
            http.stop(0);
        }
    }

    @Test void rejectsSpeedsFadesAndLooksTheEditorDoesNotOffer() {
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(timeline(List.of(new EditMedia("k", 0.0, 3.0, 0.0, 1.0, 4.0, null, null, null))))));
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(timeline(List.of(new EditMedia("k", 0.0, 3.0, 0.0, 1.0, null, 5.0, null, null))))));
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(timeline(List.of(new EditMedia("k", 0.0, 3.0, 0.0, 1.0, null, null, null, "neon"))))));
        assertEquals("STUDIO_EDIT_INVALID", code(() -> StudioEditGraph.validate(new EditTimeline(720, 1280, List.of(clip("k", 0, 3)), null, null, null,
                List.of(new EditOverlay("gif", "o", 0.0, 1.0, null, 0.0, 0.0, 100.0, 100.0, null, null)), null))));
        StudioEditGraph.validate(new EditTimeline(720, 1280, List.of(new EditMedia("k", 0.0, 3.0, 0.0, 1.0, 0.5, 0.5, 0.5, "warm")), null, null, null,
                List.of(new EditOverlay("video", "o", 0.0, 1.0, 0.0, 100.0, -200.0, 240.0, 135.0, 0.0, 1.5)), null));
    }

    /** 真 ffmpeg：变速、淡入、黑白、小窗、图片，每样都看画面。 */
    @Test void rendersSpeedFadeLookPictureInPictureAndImage(@TempDir Path dir) throws Exception {
        var ffmpeg = new FfmpegRunner(new MixcutProperties());
        Path a = dir.resolve("a.mp4"), b = dir.resolve("b.mp4"), pipFile = dir.resolve("pip.mp4"), image = dir.resolve("g.png"), out = dir.resolve("out.mp4");
        // a：前 2 秒红、后 2 秒绿，用来判断 2 倍速后颜色切换提前到第 1 秒。
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=red:size=720x1280:rate=30:duration=2", "-f", "lavfi", "-i", "color=c=green:size=720x1280:rate=30:duration=2",
                "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0[v]", "-map", "[v]", "-map", "2:a", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", a.toString()));
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=white:size=720x1280:rate=30:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", b.toString()));
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=blue:size=320x180:rate=30:duration=3", "-c:v", "libx264", "-pix_fmt", "yuv420p", pipFile.toString()));
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "color=c=yellow:size=64x64", "-frames:v", "1", image.toString()));

        var clips = List.of(new EditMedia("a", 0.0, 2.0, 0.0, 1.0, 2.0, 0.5, null, null), new EditMedia("b", 2.0, 4.0, 0.0, 1.0, null, null, null, "black_white"));
        var pips = List.of(new EditOverlay("video", "p", 1.0, 3.0, 0.0, -200.0, -400.0, 240.0, 136.0, 0.0, null),
                new EditOverlay("image", "i", 2.5, 3.5, null, 200.0, 400.0, 100.0, 100.0, null, null));
        ffmpeg.runFfmpeg(StudioEditGraph.args(720, 1280, 4, clips, List.of(a, b), List.of(true, false), List.of(), List.of(), List.of(),
                pips, List.of(pipFile, image), List.of(false, false), null, out), 120_000);

        var probe = ffmpeg.probeMedia(out.toFile());
        assertEquals(4, probe.durationSec(), 0.15);
        assertTrue(probe.hasAudio(), "原声变速后还在");
        assertTrue(brightness(ffmpeg, out, dir, 0.02) < 40, "开头是淡入，第一帧接近黑");
        assertTrue(redness(ffmpeg, out, dir, 0.7) > 150, "淡入结束后看到红色");
        var green = frame(ffmpeg, out, dir, 1.5);
        assertTrue(((green.getRGB(600, 1000) >> 8) & 255) > 90 && ((green.getRGB(600, 1000) >> 16) & 255) < 60, "2 倍速：素材第 3 秒的绿色出现在成片第 1.5 秒");
        // 小窗中心在画面中心 + (-200, -400)。
        assertEquals(0, ((frame(ffmpeg, out, dir, 0.7).getRGB(160, 240)) & 255) / 200, "小窗开始前这里没有蓝色");
        assertTrue((frame(ffmpeg, out, dir, 1.5).getRGB(160, 240) & 255) > 180, "小窗时间内这里是蓝色");
        var late = frame(ffmpeg, out, dir, 3.0);
        int pixel = late.getRGB(560, 1040);
        assertTrue(((pixel >> 16) & 255) > 180 && ((pixel >> 8) & 255) > 180 && (pixel & 255) < 90, "图片叠在指定位置");
        int plain = late.getRGB(360, 900);
        assertEquals((plain >> 16) & 255, plain & 255, 12, "黑白的画面没有颜色");
    }

    private static BufferedImage frame(FfmpegRunner ffmpeg, Path video, Path dir, double at) throws Exception {
        Path png = dir.resolve("f_" + at + ".png");
        ffmpeg.runFfmpeg(List.of("-v", "error", "-y", "-ss", String.valueOf(at), "-i", video.toString(), "-frames:v", "1", png.toString()));
        return ImageIO.read(png.toFile());
    }
    private static double brightness(FfmpegRunner ffmpeg, Path video, Path dir, double at) throws Exception {
        var img = frame(ffmpeg, video, dir, at); long sum = 0;
        for (int y = 0; y < img.getHeight(); y += 16) for (int x = 0; x < img.getWidth(); x += 16) { int p = img.getRGB(x, y); sum += ((p >> 16) & 255) + ((p >> 8) & 255) + (p & 255); }
        return sum / 3.0 / ((img.getHeight() / 16 + 1) * (img.getWidth() / 16 + 1));
    }
    private static int redness(FfmpegRunner ffmpeg, Path video, Path dir, double at) throws Exception {
        int p = frame(ffmpeg, video, dir, at).getRGB(360, 900); return (p >> 16) & 255;
    }
    /** 文字在画面中心上方 400px（y≈240）：出现期间那一带和文字消失后不一样。 */
    private static boolean changedAround(FfmpegRunner ffmpeg, Path video, Path dir, double on, double off, int x0, int y0) throws Exception {
        var a = frame(ffmpeg, video, dir, on); var b = frame(ffmpeg, video, dir, off); int changed = 0;
        for (int y = y0 - 30; y < y0 + 30; y++) for (int x = x0 - 120; x < x0 + 180; x++) if (a.getRGB(x, y) != b.getRGB(x, y)) changed++;
        return changed > 500;
    }
}
