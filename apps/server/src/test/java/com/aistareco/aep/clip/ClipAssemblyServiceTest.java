package com.aistareco.aep.clip;

import com.aistareco.aep.clip.model.ClipAsset;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.service.ClipAssemblyService;
import com.aistareco.aep.clip.service.ClipAssetService;
import com.aistareco.aep.clip.service.ClipOverlayRenderer;
import com.aistareco.aep.clip.service.ClipCoverRenderer;
import com.aistareco.aep.clip.service.ClipMediaQualityGate;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.picgen.FontRegistry;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClipAssemblyServiceTest {
    @TempDir Path temp;

    @Test
    void assemblesAvatarBrollAndGeneratedTailFromOwnedStorage() throws Exception {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipAssetService assets = mock(ClipAssetService.class);
        ClipMediaQualityGate qualityGate = mock(ClipMediaQualityGate.class);
        ClipOverlayRenderer overlays = spy(new ClipOverlayRenderer());
        ClipAssemblyService service = new ClipAssemblyService(ffmpeg, storage, assets, overlays, covers(), qualityGate);
        Path avatar = file("avatar.mp4");
        Path visual = file("visual.mp4");
        Path audio = file("speech.mp3");
        when(storage.openForRead("clip/segments/1.mp4")).thenReturn(avatar);
        when(storage.openForRead("clip/assets/2.mp4")).thenReturn(visual);
        when(storage.openForRead("clip/audio/2.mp3")).thenReturn(audio);
        when(assets.requiredVisible("owner-1", "ca_2")).thenReturn(asset("ca_2", "video", "clip/assets/2.mp4"));
        when(ffmpeg.hasAudioStream(any())).thenReturn(true);
        when(ffmpeg.probeDurationSec(any())).thenAnswer(inv -> {
            String name = ((java.io.File) inv.getArgument(0)).getName();
            return name.equals("speech.mp3") ? 3.25d : 12d;
        });
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> {
            List<String> args = inv.getArgument(0);
            Path output = Path.of(args.get(args.size() - 1));
            Files.createDirectories(output.getParent());
            Files.writeString(output, "video");
            return "ok";
        });
        when(storage.storeExisting(any(), eq("clip/works"), eq("owner-1"), eq("mp4"), eq("video/mp4"), eq(true)))
                .thenReturn(new FileStorageService.StoredFile("clip/works/final.mp4", "", "", null, 5, "video/mp4"));
        when(storage.storeExisting(any(), eq("clip/thumbnails"), eq("owner-1"), eq("jpg"), eq("image/jpeg"), eq(true)))
                .thenReturn(new FileStorageService.StoredFile("clip/thumbnails/final.jpg", "", "", null, 5, "image/jpeg"));

        ClipProject project = project(List.of(
                segment(1, "avatar", "我来开场", null, null),
                segment(2, "broll", "这里配店铺画面", "ca_2", null),
                segment(3, "tail", "结尾", null, 2)
        ));
        project.getPayloadJson().put("subtitleStyle", Map.of("aiWatermark", true));
        Map<String,Object> state = Map.of("segments", List.of(
                Map.of("no", 1, "role", "avatar", "videoCdnKey", "clip/segments/1.mp4"),
                Map.of("no", 2, "role", "broll", "audioCdnKey", "clip/audio/2.mp3"),
                Map.of("no", 3, "role", "tail")
        ));

        ClipAssemblyService.Result result = service.assemble("owner-1", project, state);

        assertEquals("clip/works/final.mp4", result.outputCdnKey());
        assertEquals("clip/thumbnails/final.jpg", result.thumbnailCdnKey());
        assertEquals(12, result.durationSec());
        ArgumentCaptor<List<String>> commands = ArgumentCaptor.forClass(List.class);
        verify(ffmpeg, times(6)).runFfmpeg(commands.capture());
        assertTrue(commands.getAllValues().stream().anyMatch(args -> args.contains("-stream_loop") && args.contains(audio.toString())));
        assertTrue(commands.getAllValues().stream().anyMatch(args -> args.stream().anyMatch(v -> v.startsWith("color=c=#17362f"))));
        assertEquals(3, commands.getAllValues().stream()
                .filter(args -> args.stream().anyMatch(value -> value.contains("overlay=0:0:format=auto")))
                .count(), "every segment must burn its timed caption or fixed-tail overlay");
        verify(overlays, times(2)).renderCaption(any(), anyInt(), anyInt(), anyString(), eq(true));
        verify(overlays).renderTail(any(), anyInt(), anyString(), anyString(), eq(true));
        assertEquals(3, commands.getAllValues().stream().filter(args -> args.contains("yuv420p")).count());
        assertTrue(commands.getAllValues().stream().anyMatch(args -> args.stream().anyMatch(v -> v.startsWith("loudnorm=I=-16"))),
                "final audio must be normalized before the quality gate");
        verify(storage).storeExisting(any(), eq("clip/works"), eq("owner-1"), eq("mp4"), eq("video/mp4"), eq(true));
        verify(storage).storeExisting(any(), eq("clip/thumbnails"), eq("owner-1"), eq("jpg"), eq("image/jpeg"), eq(true));
        verify(qualityGate).assertAcceptable(any());
    }

    @Test
    void refusesBrollWithoutMirroredTtsAudio() {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        ClipAssemblyService service = new ClipAssemblyService(ffmpeg, mock(FileStorageService.class), mock(ClipAssetService.class),
                new ClipOverlayRenderer(), covers(), mock(ClipMediaQualityGate.class));
        ClipProject project = project(List.of(segment(1, "broll", "正文", "ca_1", null)));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.assemble("owner-1", project, Map.of("segments", List.of(Map.of("no", 1, "role", "broll")))));

        assertEquals("CLIP_ASSEMBLY_FAILED", error.getCode());
        verifyNoInteractions(ffmpeg);
    }

    @Test
    void mockModeStillRunsFfmpegQualityGateAndStoresPlayableWork() throws Exception {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipMediaQualityGate qualityGate = mock(ClipMediaQualityGate.class);
        ClipAssemblyService service = new ClipAssemblyService(ffmpeg, storage, mock(ClipAssetService.class),
                new ClipOverlayRenderer(), covers(), qualityGate);
        when(ffmpeg.hasAudioStream(any())).thenReturn(true);
        when(ffmpeg.probeDurationSec(any())).thenReturn(7d);
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> {
            List<String> args = inv.getArgument(0);
            Path output = Path.of(args.get(args.size() - 1));
            Files.createDirectories(output.getParent());
            Files.writeString(output, "video");
            return "ok";
        });
        when(storage.storeExisting(any(), eq("clip/works"), eq("owner-1"), eq("mp4"), eq("video/mp4"), eq(true)))
                .thenReturn(new FileStorageService.StoredFile("clip/works/mock.mp4", "", "", null, 5, "video/mp4"));
        when(storage.storeExisting(any(), eq("clip/thumbnails"), eq("owner-1"), eq("jpg"), eq("image/jpeg"), eq(true)))
                .thenReturn(new FileStorageService.StoredFile("clip/thumbnails/mock.jpg", "", "", null, 5, "image/jpeg"));
        ClipProject project = project(List.of(
                segment(1, "broll", "第一句字幕", null, 2),
                segment(2, "broll", "第二句字幕", null, 2),
                segment(3, "tail", "结尾", null, 3)
        ));

        ClipAssemblyService.Result result = service.assembleMock("owner-1", project);

        assertEquals("clip/works/mock.mp4", result.outputCdnKey());
        assertEquals("clip/thumbnails/mock.jpg", result.thumbnailCdnKey());
        assertEquals(7, result.durationSec());
        ArgumentCaptor<List<String>> commands = ArgumentCaptor.forClass(List.class);
        verify(ffmpeg, times(5)).runFfmpeg(commands.capture());
        assertEquals(2, commands.getAllValues().stream()
                .filter(args -> args.stream().anyMatch(value -> value.startsWith("sine=frequency="))).count());
        String groupedCaptionFilter = commands.getAllValues().stream()
                .flatMap(Collection::stream)
                .filter(value -> value.contains("enable='between(t,"))
                .findFirst().orElseThrow();
        assertEquals(2, occurrences(groupedCaptionFilter, "enable='between(t,"),
                "two sentences sharing one visual shot must still appear as two timed captions");
        assertTrue(commands.getAllValues().stream().anyMatch(args -> args.stream().anyMatch(v -> v.startsWith("loudnorm=I=-16"))));
        verify(qualityGate).assertAcceptable(any());
    }

    @Test
    void prependsCoverAsTheVeryFirstFrameAndTakesTheThumbnailFromIt() throws Exception {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipAssemblyService service = new ClipAssemblyService(ffmpeg, storage, mock(ClipAssetService.class),
                new ClipOverlayRenderer(), covers(), mock(ClipMediaQualityGate.class));
        List<String> concatList = new ArrayList<>();
        when(ffmpeg.hasAudioStream(any())).thenReturn(true);
        when(ffmpeg.probeDurationSec(any())).thenReturn(7d);
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> {
            List<String> args = inv.getArgument(0);
            if (args.contains("concat")) {
                concatList.addAll(Files.readAllLines(Path.of(args.get(args.indexOf("-i") + 1))));
            }
            Path output = Path.of(args.get(args.size() - 1));
            Files.createDirectories(output.getParent());
            Files.writeString(output, "video");
            return "ok";
        });
        when(storage.storeExisting(any(), eq("clip/works"), eq("owner-1"), eq("mp4"), eq("video/mp4"), eq(true)))
                .thenReturn(new FileStorageService.StoredFile("clip/works/mock.mp4", "", "", null, 5, "video/mp4"));
        when(storage.storeExisting(any(), eq("clip/thumbnails"), eq("owner-1"), eq("jpg"), eq("image/jpeg"), eq(true)))
                .thenReturn(new FileStorageService.StoredFile("clip/thumbnails/mock.jpg", "", "", null, 5, "image/jpeg"));
        ClipProject project = project(List.of(
                segment(1, "avatar", "我来开场", null, 3),
                segment(2, "tail", "结尾", null, 2)));
        project.getPayloadJson().put("cover", Map.of(
                "enabled", true, "keyword", "团结", "handle", "@可乐米乐麻麻讲Ai",
                "sloganLines", List.of("一群人一条心", "一件事一起拼"), "signature", "集体为实体发声"));

        service.assembleMock("owner-1", project);

        ArgumentCaptor<List<String>> commands = ArgumentCaptor.forClass(List.class);
        verify(ffmpeg, atLeastOnce()).runFfmpeg(commands.capture());
        List<String> coverEncode = commands.getAllValues().stream()
                .filter(args -> args.get(args.size() - 1).endsWith("segment-cover.mp4"))
                .findFirst().orElseThrow(() -> new AssertionError("封面必须被编码成一段视频"));
        assertTrue(coverEncode.contains("-loop"), "封面是静止图，必须用 -loop 喂给 ffmpeg");
        assertEquals("0.040", coverEncode.get(coverEncode.indexOf("-t") + 1),
                "封面时长必须是常量 COVER_DURATION_SEC，不能被 0.1 秒下限抬高");
        assertTrue(coverEncode.containsAll(List.of("libx264", "yuv420p", "aac")),
                "封面段编码参数必须与正片一致，否则 concat 的 -c copy 快路径会失败");

        assertTrue(concatList.get(0).contains("segment-cover.mp4"), "封面必须排在成片最前面：" + concatList);
        assertEquals(3, concatList.size(), "封面 + 出镜段 + 尾卡");

        List<String> thumbnail = commands.getAllValues().stream()
                .filter(args -> args.get(args.size() - 1).endsWith("thumbnail.jpg"))
                .findFirst().orElseThrow();
        assertEquals("0", thumbnail.get(thumbnail.indexOf("-ss") + 1),
                "有封面时缩略图必须取第 0 帧，站内列表要和平台抓到的封面一致");
    }

    @Test
    void skipsCoverEntirelyWhenTheUserLeftItOff() throws Exception {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipAssemblyService service = new ClipAssemblyService(ffmpeg, storage, mock(ClipAssetService.class),
                new ClipOverlayRenderer(), covers(), mock(ClipMediaQualityGate.class));
        when(ffmpeg.hasAudioStream(any())).thenReturn(true);
        when(ffmpeg.probeDurationSec(any())).thenReturn(7d);
        when(ffmpeg.runFfmpeg(anyList())).thenAnswer(inv -> {
            List<String> args = inv.getArgument(0);
            Path output = Path.of(args.get(args.size() - 1));
            Files.createDirectories(output.getParent());
            Files.writeString(output, "video");
            return "ok";
        });
        when(storage.storeExisting(any(), any(), any(), any(), any(), anyBoolean()))
                .thenReturn(new FileStorageService.StoredFile("clip/works/mock.mp4", "", "", null, 5, "video/mp4"));
        ClipProject project = project(List.of(segment(1, "avatar", "我来开场", null, 3)));
        // 建项目时写入的默认值就是这个形状：开关关着、槽位没填
        project.getPayloadJson().put("cover", Map.of("enabled", false));

        service.assembleMock("owner-1", project);

        ArgumentCaptor<List<String>> commands = ArgumentCaptor.forClass(List.class);
        verify(ffmpeg, atLeastOnce()).runFfmpeg(commands.capture());
        assertTrue(commands.getAllValues().stream()
                        .noneMatch(args -> args.get(args.size() - 1).endsWith("segment-cover.mp4")),
                "不填就不该加封面");
        List<String> thumbnail = commands.getAllValues().stream()
                .filter(args -> args.get(args.size() - 1).endsWith("thumbnail.jpg"))
                .findFirst().orElseThrow();
        assertEquals("0.2", thumbnail.get(thumbnail.indexOf("-ss") + 1), "没封面时保持原有的 0.2 秒取帧口径");
    }

    @Test
    void picksTheAvatarShotAsCoverBackgroundUnlessTheUserNamedASentence() {
        List<Map<String, Object>> shots = List.of(
                Map.of("no", 1, "role", "broll", "sourceNos", List.of(1, 2)),
                Map.of("no", 2, "role", "avatar", "sourceNos", List.of(3)),
                Map.of("no", 3, "role", "tail", "sourceNos", List.of(4)));

        assertEquals(1, ClipAssemblyService.coverSourceIndex(0, shots), "没指定就挑形象出镜段");
        assertEquals(0, ClipAssemblyService.coverSourceIndex(2, shots), "指定的句子要映射回它所在的镜头");
        assertEquals(2, ClipAssemblyService.coverSourceIndex(4, shots));
        assertEquals(1, ClipAssemblyService.coverSourceIndex(99, shots), "指定了不存在的句子就回落形象段");
        assertEquals(-1, ClipAssemblyService.coverSourceIndex(1, List.of()));
    }

    private static ClipCoverRenderer covers() {
        FontRegistry fonts = new FontRegistry();
        fonts.load();
        return new ClipCoverRenderer(fonts);
    }

    private Path file(String name) throws Exception {
        Path path = temp.resolve(name);
        Files.writeString(path, "source");
        return path;
    }

    private static ClipAsset asset(String id, String kind, String key) {
        return ClipAsset.builder().id(id).externalOwnerId("owner-1").kind(kind).label(id).mimeType("video/mp4")
                .cdnKey(key).createdAt(Instant.now()).build();
    }

    private static Map<String,Object> segment(int no, String role, String text, String assetId, Integer duration) {
        Map<String,Object> row = new LinkedHashMap<>();
        row.put("no", no); row.put("role", role); row.put("text", text);
        if (assetId != null) row.put("assetId", assetId);
        if (duration != null) row.put("durationSec", duration);
        return row;
    }

    private static ClipProject project(List<Map<String,Object>> segments) {
        return ClipProject.builder().id("cp_1").externalOwnerId("owner-1").templateId("ct_1")
                .templateName("模板").title("作品").payloadJson(new LinkedHashMap<>(Map.of("segments", segments)))
                .createdAt(Instant.now()).updatedAt(Instant.now()).build();
    }

    private static int occurrences(String value, String needle) {
        int count = 0;
        for (int at = 0; (at = value.indexOf(needle, at)) >= 0; at += needle.length()) count++;
        return count;
    }
}
