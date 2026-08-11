package com.aistareco.aep.clip;

import com.aistareco.aep.clip.model.ClipAsset;
import com.aistareco.aep.clip.model.ClipProject;
import com.aistareco.aep.clip.service.ClipAssemblyService;
import com.aistareco.aep.clip.service.ClipAssetService;
import com.aistareco.aep.clip.service.ClipOverlayRenderer;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
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
        ClipAssemblyService service = new ClipAssemblyService(ffmpeg, storage, assets, new ClipOverlayRenderer());
        Path avatar = file("avatar.mp4");
        Path visual = file("visual.mp4");
        Path audio = file("speech.mp3");
        when(storage.openForRead("clip/segments/1.mp4")).thenReturn(avatar);
        when(storage.openForRead("clip/assets/2.mp4")).thenReturn(visual);
        when(storage.openForRead("clip/audio/2.mp3")).thenReturn(audio);
        when(assets.requiredVisible("owner-1", "ca_2")).thenReturn(asset("ca_2", "video", "clip/assets/2.mp4"));
        when(ffmpeg.hasAudioStream(avatar.toFile())).thenReturn(true);
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

        ClipProject project = project(List.of(
                segment(1, "avatar", "我来开场", null, null),
                segment(2, "broll", "这里配店铺画面", "ca_2", null),
                segment(3, "tail", "结尾", null, 2)
        ));
        Map<String,Object> state = Map.of("segments", List.of(
                Map.of("no", 1, "role", "avatar", "videoCdnKey", "clip/segments/1.mp4"),
                Map.of("no", 2, "role", "broll", "audioCdnKey", "clip/audio/2.mp3"),
                Map.of("no", 3, "role", "tail")
        ));

        ClipAssemblyService.Result result = service.assemble("owner-1", project, state);

        assertEquals("clip/works/final.mp4", result.outputCdnKey());
        assertEquals(12, result.durationSec());
        ArgumentCaptor<List<String>> commands = ArgumentCaptor.forClass(List.class);
        verify(ffmpeg, times(4)).runFfmpeg(commands.capture());
        assertTrue(commands.getAllValues().stream().anyMatch(args -> args.contains("-stream_loop") && args.contains(audio.toString())));
        assertTrue(commands.getAllValues().stream().anyMatch(args -> args.stream().anyMatch(v -> v.startsWith("color=c=#17362f"))));
        assertEquals(3, commands.getAllValues().stream()
                .filter(args -> args.stream().anyMatch(value -> value.contains("overlay=0:0:format=auto")))
                .count(), "every segment must burn the permanent overlay");
        assertEquals(3, commands.getAllValues().stream().filter(args -> args.contains("yuv420p")).count());
        verify(storage).storeExisting(any(), eq("clip/works"), eq("owner-1"), eq("mp4"), eq("video/mp4"), eq(true));
    }

    @Test
    void refusesBrollWithoutMirroredTtsAudio() {
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        ClipAssemblyService service = new ClipAssemblyService(ffmpeg, mock(FileStorageService.class), mock(ClipAssetService.class),
                new ClipOverlayRenderer());
        ClipProject project = project(List.of(segment(1, "broll", "正文", "ca_1", null)));

        BusinessException error = assertThrows(BusinessException.class,
                () -> service.assemble("owner-1", project, Map.of("segments", List.of(Map.of("no", 1, "role", "broll")))));

        assertEquals("CLIP_ASSEMBLY_FAILED", error.getCode());
        verifyNoInteractions(ffmpeg);
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
}
