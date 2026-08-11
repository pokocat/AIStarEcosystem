package com.aistareco.aep.clip;

import com.aistareco.aep.clip.service.ClipAssetThumbnailExtractor;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClipAssetThumbnailExtractorTest {
    @Test
    void extractsAndStoresVideoThumbnail() throws Exception {
        FileStorageService storage = mock(FileStorageService.class);
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        Path input = Files.createTempFile("clip-asset-input-", ".mp4");
        when(storage.openForRead("clip/assets/source.mp4")).thenReturn(input);
        doAnswer(invocation -> {
            var args = invocation.<java.util.List<String>>getArgument(0);
            Files.write(Path.of(args.get(args.size() - 1)), new byte[] {1, 2, 3});
            return "ok";
        }).when(ffmpeg).runFfmpeg(anyList());
        var expected = new FileStorageService.StoredFile("clip/asset-thumbnails/thumb.jpg", "u", "s", null, 3, "image/jpeg");
        when(storage.storeExisting(any(Path.class), eq("clip/asset-thumbnails"), eq("owner-1"), eq("jpg"), eq("image/jpeg"), eq(true)))
                .thenReturn(expected);

        var actual = new ClipAssetThumbnailExtractor(storage, ffmpeg).extract("owner-1", "clip/assets/source.mp4");

        assertEquals(expected.key(), actual.key());
        verify(ffmpeg).runFfmpeg(argThat(args -> args.contains("-frames:v") && args.contains("0.5")));
        Files.deleteIfExists(input);
    }
}
