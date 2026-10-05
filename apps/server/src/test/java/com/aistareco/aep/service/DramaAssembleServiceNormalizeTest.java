package com.aistareco.aep.service;

import com.aistareco.aep.config.MixcutProperties;
import com.aistareco.aep.repository.DramaProjectRepository;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.*;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 画布合成（{@link DramaAssembleService#assembleKeys}）的两条拼法：各段参数一致 → 流复制（copy），
 * 不一致（宽高 / 视频编码 / 有没有音轨 / 音轨参数）→ 一条 filter_complex 统一画幅重编码（normalize）。
 * 参数构造是纯函数，不需要 ffmpeg；最后一个用例在本机有 ffmpeg 时真跑一遍。
 */
class DramaAssembleServiceNormalizeTest {

    private static FfmpegRunner.MediaProbe clip(int w, int h, String vcodec, String acodec, int rate, int ch, double dur) {
        return new FfmpegRunner.MediaProbe(dur, "mp4", vcodec, acodec, w, h, acodec == null ? 0 : rate,
                acodec == null ? 0 : ch, true);
    }

    private static FfmpegRunner.MediaProbe portrait(boolean audio) {
        return clip(720, 1280, "h264", audio ? "aac" : null, 44100, 2, 5.0);
    }

    // ── 选路 ───────────────────────────────────────────────────────────────────

    @Test
    void uniformForCopy_onlyWhenSizeCodecAndAudioAllMatch() {
        assertTrue(DramaAssembleService.uniformForCopy(List.of(portrait(true), portrait(true))));
        assertTrue(DramaAssembleService.uniformForCopy(List.of(portrait(false), portrait(false))));
        // 宽高不同（H3 竖屏 768×1024 与别的模型的 9:16）
        assertFalse(DramaAssembleService.uniformForCopy(List.of(portrait(true),
                clip(768, 1024, "h264", "aac", 44100, 2, 5))));
        // 有的段没有音轨
        assertFalse(DramaAssembleService.uniformForCopy(List.of(portrait(true), portrait(false))));
        // 视频编码不同
        assertFalse(DramaAssembleService.uniformForCopy(List.of(portrait(true),
                clip(720, 1280, "hevc", "aac", 44100, 2, 5))));
        // 音轨采样率 / 声道不同
        assertFalse(DramaAssembleService.uniformForCopy(List.of(portrait(true),
                clip(720, 1280, "h264", "aac", 48000, 2, 5))));
        assertFalse(DramaAssembleService.uniformForCopy(List.of(portrait(true),
                clip(720, 1280, "h264", "aac", 44100, 1, 5))));
    }

    @Test
    void targetSize_noRatio_mostCommon_tieGoesToFirstClip_evenDimensions() {
        FfmpegRunner.MediaProbe h3 = clip(768, 1024, "h264", null, 0, 0, 5);
        assertArrayEquals(new int[]{720, 1280},
                DramaAssembleService.targetSize(List.of(h3, portrait(true), portrait(true)), null));
        assertArrayEquals(new int[]{768, 1024},
                DramaAssembleService.targetSize(List.of(h3, portrait(true)), null));
        assertArrayEquals(new int[]{720, 1280},
                DramaAssembleService.targetSize(List.of(portrait(true), h3), null));
        assertArrayEquals(new int[]{720, 1278},
                DramaAssembleService.targetSize(List.of(clip(721, 1279, "h264", null, 0, 0, 5)), null));
        // 比例读不出 → 同 null
        assertArrayEquals(new int[]{768, 1024},
                DramaAssembleService.targetSize(List.of(h3, portrait(true)), "竖屏"));
    }

    /** 2026-10-03 生产：9:16 画布，第一段老的 768×1024（3:4），第二段新的 768×1344 → 成片要 9:16。 */
    @Test
    void targetSize_canvasRatio_productionCase_followsCanvasNotFirstClip() {
        FfmpegRunner.MediaProbe h3Old = clip(768, 1024, "h264", null, 0, 0, 5);
        FfmpegRunner.MediaProbe h3New = clip(768, 1344, "h264", null, 0, 0, 5);
        assertArrayEquals(new int[]{768, 1344},
                DramaAssembleService.targetSize(List.of(h3Old, h3New), "9:16"));
    }

    @Test
    void targetSize_canvasRatio_beatsMajorityOfOtherRatio() {
        FfmpegRunner.MediaProbe h3Old = clip(768, 1024, "h264", null, 0, 0, 5);
        assertArrayEquals(new int[]{720, 1280},
                DramaAssembleService.targetSize(List.of(h3Old, h3Old, portrait(true)), "9:16"));
    }

    @Test
    void targetSize_canvasRatio_tieAmongMatching_largerAreaWins_thenFirst() {
        FfmpegRunner.MediaProbe big = clip(1080, 1920, "h264", null, 0, 0, 5);
        assertArrayEquals(new int[]{1080, 1920},
                DramaAssembleService.targetSize(List.of(portrait(true), big), "9:16"));
        // 次数多的仍然优先于面积大的
        assertArrayEquals(new int[]{720, 1280},
                DramaAssembleService.targetSize(List.of(big, portrait(true), portrait(true)), "9:16"));
        // 对得上画布比例、次数相同、面积也相同的两种尺寸 → 取先出现的
        // （918×1664 与 936×1632 面积都是 1,527,552，宽高比都在 9:16 的 2% 以内）
        FfmpegRunner.MediaProbe a = clip(918, 1664, "h264", null, 0, 0, 5);
        FfmpegRunner.MediaProbe b = clip(936, 1632, "h264", null, 0, 0, 5);
        assertArrayEquals(new int[]{936, 1632},
                DramaAssembleService.targetSize(List.of(b, a), "9:16"));
        assertArrayEquals(new int[]{918, 1664},
                DramaAssembleService.targetSize(List.of(a, b), "9:16"));
    }

    @Test
    void targetSize_canvasRatio_noClipMatches_fallsBackToMostCommon_tieFirst() {
        FfmpegRunner.MediaProbe h3Old = clip(768, 1024, "h264", null, 0, 0, 5);
        FfmpegRunner.MediaProbe square = clip(768, 768, "h264", null, 0, 0, 5);
        assertArrayEquals(new int[]{768, 1024},
                DramaAssembleService.targetSize(List.of(h3Old, square), "9:16"));
        assertArrayEquals(new int[]{768, 768},
                DramaAssembleService.targetSize(List.of(h3Old, square, square), "9:16"));
        // 16:9 画布里全是竖屏片段 → 同样按旧规则
        assertArrayEquals(new int[]{720, 1280},
                DramaAssembleService.targetSize(List.of(portrait(true), h3Old, portrait(true)), "16:9"));
    }

    @Test
    void normalizeArgs_oneFilterGraph_scalePadPerClip_silenceForClipsWithoutAudio() {
        Path a = Path.of("/tmp/w/clip_0.mp4");
        Path b = Path.of("/tmp/w/clip_1.mp4");
        Path out = Path.of("/tmp/w/episode.mp4");
        List<String> args = DramaAssembleService.normalizeArgs(List.of(a, b),
                List.of(portrait(true), clip(768, 1024, "h264", null, 0, 0, 4.25)), 720, 1280, out);

        assertEquals("-y", args.get(0));
        assertEquals(List.of("-i", a.toString(), "-i", b.toString()), args.subList(1, 5));
        assertFalse(args.contains("concat") || args.contains("-f"), "不走 concat 分离器: " + args);
        String graph = args.get(args.indexOf("-filter_complex") + 1);
        String video = "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,"
                + "setsar=1,fps=30,format=yuv420p";
        assertTrue(graph.contains("[0:v]" + video + "[v0]"), graph);
        assertTrue(graph.contains("[1:v]" + video + "[v1]"), graph);
        assertTrue(graph.contains("[0:a]aresample=44100,"), graph);
        assertFalse(graph.contains("[1:a]"), "第二段没有音轨，不能引用 [1:a]: " + graph);
        assertTrue(graph.contains("anullsrc=r=44100:cl=stereo,atrim=duration=4.250,"), graph);
        assertTrue(graph.endsWith("[v0][a0][v1][a1]concat=n=2:v=1:a=1[vout][aout]"), graph);

        assertEquals("[vout]", args.get(args.indexOf("-map") + 1));
        assertEquals("[aout]", args.get(args.lastIndexOf("-map") + 1));
        assertEquals("libx264", args.get(args.indexOf("-c:v") + 1));
        assertEquals("veryfast", args.get(args.indexOf("-preset") + 1));
        assertEquals("aac", args.get(args.indexOf("-c:a") + 1));
        assertEquals("+faststart", args.get(args.indexOf("-movflags") + 1));
        assertEquals(out.toString(), args.get(args.size() - 1));
    }

    // ── assembleKeys 走哪条路（ffmpeg mock） ──────────────────────────────────────

    private HttpServer http;
    private final FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
    private final CdnUploader uploader = mock(CdnUploader.class);
    private final CdnUrlSigner signer = mock(CdnUrlSigner.class);
    private DramaAssembleService svc;
    private final List<FfmpegRunner.MediaProbe> clipProbes = new ArrayList<>();
    private final List<List<String>> ffmpegCalls = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        http = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        http.createContext("/", ex -> {
            byte[] body = {1, 2, 3, 4};
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        http.start();
        svc = new DramaAssembleService(mock(DramaProjectRepository.class), ffmpeg, uploader, signer,
                mock(StorageQuotaService.class), new ObjectMapper(), http.getAddress().getPort(), "/cdn", "");
        when(signer.signKey(anyString())).thenAnswer(inv -> "/cdn/" + inv.getArgument(0));
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> {
            List<String> args = inv.getArgument(0);
            ffmpegCalls.add(args);
            Files.write(Path.of(args.get(args.size() - 1)), new byte[]{9, 9, 9});
            return "";
        });
        when(ffmpeg.probeMedia(any(File.class))).thenAnswer(inv -> {
            File f = inv.getArgument(0);
            if (f.getName().startsWith("clip_")) {
                int i = Integer.parseInt(f.getName().substring(5, f.getName().indexOf('.')));
                return clipProbes.get(i);
            }
            double total = clipProbes.stream().mapToDouble(FfmpegRunner.MediaProbe::durationSec).sum();
            return new FfmpegRunner.MediaProbe(total, "mp4", "h264", "aac", 720, 1280, 44100, 2, true);
        });
    }

    @AfterEach
    void tearDown() {
        if (http != null) http.stop(0);
    }

    @Test
    void sameParameters_copyPath() {
        clipProbes.addAll(List.of(portrait(true), portrait(true)));
        svc.assembleKeys("u1", "dcv_1", 1, List.of("k0.mp4", "k1.mp4"), "9:16");
        assertEquals(1, ffmpegCalls.size());
        assertTrue(ffmpegCalls.get(0).containsAll(List.of("-f", "concat", "-c", "copy")), ffmpegCalls.get(0).toString());
    }

    @Test
    void differentSizes_normalizePath_singleFilterGraphEncode() throws Exception {
        clipProbes.addAll(List.of(portrait(true), clip(768, 1024, "h264", "aac", 44100, 2, 5), portrait(true)));
        DramaAssembleService.AssembledVideo a = svc.assembleKeys("u1", "dcv_1", 1, List.of("k0.mp4", "k1.mp4", "k2.mp4"), "9:16");
        assertEquals(1, ffmpegCalls.size());
        List<String> args = ffmpegCalls.get(0);
        assertFalse(args.contains("concat"), args.toString());
        String graph = args.get(args.indexOf("-filter_complex") + 1);
        assertTrue(graph.contains("concat=n=3:v=1:a=1"), graph);
        assertTrue(graph.contains("scale=720:1280:"), graph);
        assertEquals(15, a.durationSec());
        verify(uploader).upload(any(Path.class), eq(a.key()), eq("video/mp4"));
    }

    @Test
    void normalizePath_targetFollowsCanvasRatio_nullRatioKeepsOldRule() {
        clipProbes.addAll(List.of(clip(768, 1024, "h264", "aac", 44100, 2, 5), clip(768, 1344, "h264", "aac", 44100, 2, 5)));
        svc.assembleKeys("u1", "dcv_1", 1, List.of("k0.mp4", "k1.mp4"), "9:16");
        String graph = ffmpegCalls.get(0).get(ffmpegCalls.get(0).indexOf("-filter_complex") + 1);
        assertTrue(graph.contains("scale=768:1344:"), graph);

        ffmpegCalls.clear();
        svc.assembleKeys("u1", "dcv_1", 1, List.of("k0.mp4", "k1.mp4"), null); // 老运行没快照比例
        graph = ffmpegCalls.get(0).get(ffmpegCalls.get(0).indexOf("-filter_complex") + 1);
        assertTrue(graph.contains("scale=768:1024:"), graph);
    }

    @Test
    void someClipsWithoutAudio_normalizePath_withSilence() {
        clipProbes.addAll(List.of(portrait(true), portrait(false)));
        svc.assembleKeys("u1", "dcv_1", 1, List.of("k0.mp4", "k1.mp4"), "9:16");
        assertEquals(1, ffmpegCalls.size());
        String graph = ffmpegCalls.get(0).get(ffmpegCalls.get(0).indexOf("-filter_complex") + 1);
        assertTrue(graph.contains("anullsrc"), graph);
    }

    @Test
    void normalizePath_durationGateStillApplies() throws Exception {
        clipProbes.addAll(List.of(portrait(true), portrait(false)));
        reset(ffmpeg);
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> {
            List<String> args = inv.getArgument(0);
            Files.write(Path.of(args.get(args.size() - 1)), new byte[]{9});
            return "";
        });
        when(ffmpeg.probeMedia(any(File.class))).thenAnswer(inv -> {
            File f = inv.getArgument(0);
            if (f.getName().startsWith("clip_")) {
                return clipProbes.get(Integer.parseInt(f.getName().substring(5, f.getName().indexOf('.'))));
            }
            return new FfmpegRunner.MediaProbe(3.0, "mp4", "h264", "aac", 720, 1280, 44100, 2, true); // 应是 10 秒
        });
        var e = assertThrows(com.aistareco.common.BusinessException.class,
                () -> svc.assembleKeys("u1", "dcv_1", 1, List.of("k0.mp4", "k1.mp4"), "9:16"));
        assertEquals("DRAMA_ASSEMBLE_FAILED", e.getCode());
        verify(uploader, never()).upload(any(), any(), any());
    }

    // ── 真 ffmpeg（本机有才跑） ──────────────────────────────────────────────────

    @Test
    void realFfmpeg_mixedSizesAndMissingAudio_producesOnePlayableEpisode(@TempDir Path dir) throws Exception {
        FfmpegRunner real = new FfmpegRunner(new MixcutProperties());
        assumeTrue(ffmpegAvailable(real), "本机没有 ffmpeg / ffprobe");
        // 三段：9:16 带 48k 单声道、768×1024 无音轨（H3 竖屏）、9:16 带 44.1k 立体声
        Path c0 = dir.resolve("src0.mp4");
        Path c1 = dir.resolve("src1.mp4");
        Path c2 = dir.resolve("src2.mp4");
        real.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24:duration=2",
                "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000:duration=2", "-ac", "1",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", c0.toString()));
        real.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=768x1024:rate=25:duration=3",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", c1.toString()));
        real.runFfmpeg(List.of("-v", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=30:duration=2",
                "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=44100:duration=2",
                "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", c2.toString()));

        Map<String, Path> files = new ConcurrentHashMap<>(Map.of("/cdn/k0.mp4", c0, "/cdn/k1.mp4", c1, "/cdn/k2.mp4", c2));
        HttpServer srv = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        srv.createContext("/", ex -> {
            byte[] body = Files.readAllBytes(files.get(ex.getRequestURI().getPath()));
            ex.sendResponseHeaders(200, body.length);
            ex.getResponseBody().write(body);
            ex.close();
        });
        srv.start();
        Path kept = dir.resolve("episode-kept.mp4");
        try {
            CdnUploader up = mock(CdnUploader.class);
            doAnswer(inv -> {
                Files.copy((Path) inv.getArgument(0), kept, StandardCopyOption.REPLACE_EXISTING);
                return null;
            }).when(up).upload(any(Path.class), anyString(), anyString());
            DramaAssembleService realSvc = new DramaAssembleService(mock(DramaProjectRepository.class), real, up, signer,
                    mock(StorageQuotaService.class), new ObjectMapper(), srv.getAddress().getPort(), "/cdn", "");

            DramaAssembleService.AssembledVideo a = realSvc.assembleKeys("u1", "dcv_1", 1,
                    List.of("k0.mp4", "k1.mp4", "k2.mp4"), "9:16");
            FfmpegRunner.MediaProbe outProbe = real.probeMedia(kept.toFile());
            assertTrue(outProbe.readable() && outProbe.hasVideo() && outProbe.hasAudio(), outProbe.toString());
            assertEquals(720, outProbe.width());
            assertEquals(1280, outProbe.height());
            assertEquals(44100, outProbe.sampleRate());
            assertEquals(2, outProbe.channels());
            assertEquals(7.0, outProbe.durationSec(), 0.5);
            assertEquals(7, a.durationSec());
        } finally {
            srv.stop(0);
        }
    }

    private static boolean ffmpegAvailable(FfmpegRunner runner) {
        try {
            runner.runFfmpeg(List.of("-version"));
            runner.runFfprobe(List.of("-version"));
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
