package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.model.ClipAsset;
import com.aistareco.aep.clip.repository.ClipAssetRepository;
import com.aistareco.aep.clip.service.ClipAssetService;
import com.aistareco.aep.clip.service.ClipAssetThumbnailExtractor;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ClipAssetServiceTest {
    @Test
    void videoUploadReturnsReadableLabelAndJpegPreview() throws Exception {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipProperties props = new ClipProperties();
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        ClipAssetThumbnailExtractor thumbnails = mock(ClipAssetThumbnailExtractor.class);
        var input = Files.createTempFile("clip-asset-", ".mp4");
        var source = new FileStorageService.StoredFile("clip/assets/source.mp4", "u", "s", input.toString(), 3, "video/mp4");
        var thumbnail = new FileStorageService.StoredFile("clip/asset-thumbnails/thumb.jpg", "u", "s", null, 3, "image/jpeg");
        when(storage.store(any(), eq("clip/assets"), eq("owner-1"))).thenReturn(source);
        when(storage.openForRead(source.key())).thenReturn(input);
        when(ffmpeg.probeDurationSec(any())).thenReturn(8.0);
        when(thumbnails.extract("owner-1", source.key())).thenReturn(thumbnail);
        when(repo.save(any(ClipAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(storage.signedUrl(thumbnail.key())).thenReturn("https://cdn.example/thumb.jpg");
        when(storage.signedUrl(source.key())).thenReturn("https://cdn.example/source.mp4");
        var file = new MockMultipartFile("file", "tmp_fc984c89bb3436e0ed4f696c98b19a63963.mp4", "video/mp4", new byte[] {1, 2, 3});
        ClipAssetService service = new ClipAssetService(repo, storage, props, ffmpeg, thumbnails);

        var result = service.upload("owner-1", file, "video", null, false, null);

        assertEquals("我的视频素材", result.label());
        assertEquals("https://cdn.example/thumb.jpg", result.previewUrl());
        assertEquals("https://cdn.example/source.mp4", result.contentUrl());
        verify(repo).save(argThat(asset -> thumbnail.key().equals(asset.getThumbnailCdnKey())));
        Files.deleteIfExists(input);
    }

    @Test
    void deleteAlsoRemovesGeneratedThumbnail() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipAssetThumbnailExtractor thumbnails = mock(ClipAssetThumbnailExtractor.class);
        ClipAsset asset = ClipAsset.builder().id("ca_1").externalOwnerId("owner-1").kind("video").label("门头")
                .mimeType("video/mp4").cdnKey("clip/assets/source.mp4").thumbnailCdnKey("clip/asset-thumbnails/thumb.jpg")
                .createdAt(Instant.now()).build();
        when(repo.findByIdAndExternalOwnerIdAndDeletedAtIsNull("ca_1", "owner-1")).thenReturn(Optional.of(asset));
        ClipAssetService service = new ClipAssetService(repo, storage, new ClipProperties(), mock(FfmpegRunner.class), thumbnails);

        service.delete("owner-1", "ca_1");

        verify(storage).delete("clip/assets/source.mp4");
        verify(storage).delete("clip/asset-thumbnails/thumb.jpg");
        verify(repo).delete(asset);
    }
}
