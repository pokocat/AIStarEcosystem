package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.model.ClipAsset;
import com.aistareco.aep.clip.repository.ClipAssetRepository;
import com.aistareco.aep.clip.service.ClipAssetService;
import com.aistareco.aep.clip.service.ClipTemplateService;
import com.aistareco.aep.clip.service.ClipAssetThumbnailExtractor;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
        // 时长与宽高现在同出一次 probeMedia（原先是单独的 probeDurationSec）。
        when(ffmpeg.probeMedia(any())).thenReturn(new FfmpegRunner.MediaProbe(8.0, "mov,mp4", "h264", "aac", 1080, 1920, 44100, 2, true));
        when(thumbnails.extract("owner-1", source.key())).thenReturn(thumbnail);
        when(repo.save(any(ClipAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(storage.signedUrl(thumbnail.key())).thenReturn("https://cdn.example/thumb.jpg");
        when(storage.signedUrl(source.key())).thenReturn("https://cdn.example/source.mp4");
        var file = new MockMultipartFile("file", "tmp_fc984c89bb3436e0ed4f696c98b19a63963.mp4", "video/mp4", new byte[] {1, 2, 3});
        ClipAssetService service = new ClipAssetService(repo, storage, props, ffmpeg, thumbnails, mock(ClipTemplateService.class));

        var result = service.upload("owner-1", file, "video", null, false, null);

        assertEquals("我的视频素材", result.label());
        assertEquals("https://cdn.example/thumb.jpg", result.previewUrl());
        assertEquals("https://cdn.example/source.mp4", result.contentUrl());
        assertEquals(8.0, result.durationSec());
        // 上传分辨率决定成片分辨率，所以宽高必须落库并回传，端上才能把画质摆给用户看。
        assertEquals(1080, result.width());
        assertEquals(1920, result.height());
        verify(repo).save(argThat(asset -> thumbnail.key().equals(asset.getThumbnailCdnKey())));
        Files.deleteIfExists(input);
    }

    /**
     * 探测不出宽高时**必须留 null**，不许落 0。
     * 0 会被端上渲染成「0×0」，把"没测到"说成"这素材是 0 像素"——空态与失败态不许混。
     * 同时验证端上报的尺寸只在探测失败时才被采信。
     */
    @Test
    void unprobeableDimensionsStayNullAndFallBackToClientValues() throws Exception {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        FfmpegRunner ffmpeg = mock(FfmpegRunner.class);
        ClipAssetThumbnailExtractor thumbnails = mock(ClipAssetThumbnailExtractor.class);
        var input = Files.createTempFile("clip-asset-", ".mp4");
        var source = new FileStorageService.StoredFile("clip/assets/source.mp4", "u", "s", input.toString(), 3, "video/mp4");
        when(storage.store(any(), eq("clip/assets"), eq("owner-1"))).thenReturn(source);
        when(storage.openForRead(source.key())).thenReturn(input);
        when(ffmpeg.probeMedia(any())).thenReturn(new FfmpegRunner.MediaProbe(0, "", null, null, 0, 0, 0, 0, false));
        when(repo.save(any(ClipAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));
        var file = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[] {1, 2, 3});
        ClipAssetService service = new ClipAssetService(repo, storage, new ClipProperties(), ffmpeg, thumbnails, mock(ClipTemplateService.class));

        // ① 端上也没给 → 保持未知
        var unknown = service.upload("owner-1", file, "video", null, false, null, null, null);
        assertNull(unknown.width());
        assertNull(unknown.height());

        // ② 端上给了 → 探测失败时采信端上值
        var fallback = service.upload("owner-1", file, "video", null, false, null, 720, 1280);
        assertEquals(720, fallback.width());
        assertEquals(1280, fallback.height());

        // ③ 端上只给了一半 → 整体丢弃，半个尺寸不算尺寸
        var halfKnown = service.upload("owner-1", file, "video", null, false, null, 720, 0);
        assertNull(halfKnown.width());
        assertNull(halfKnown.height());
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
        // required() 改成先按 id 查再判归属：预置素材不属于任何人，按 owner 查会把「删不得」说成「查无此物」。
        when(repo.findById("ca_1")).thenReturn(Optional.of(asset));
        ClipAssetService service = new ClipAssetService(repo, storage, new ClipProperties(), mock(FfmpegRunner.class), thumbnails, mock(ClipTemplateService.class));

        service.delete("owner-1", "ca_1");

        verify(storage).delete("clip/assets/source.mp4");
        verify(storage).delete("clip/asset-thumbnails/thumb.jpg");
        verify(repo).delete(asset);
    }

    @Test
    @DisplayName("删内置素材要说「删不得」，不能说「素材不存在或无权访问」")
    void presetDeleteSaysWhyInsteadOfNotFound() {
        // 真机复现（2026-08-14，追查号 BDMCTJKH77K2）：list() 把 preset 素材混排进每个人的素材库，
        // 但它的 externalOwnerId 是 null。原 required() 按 owner 查直接抛 NOT_FOUND，
        // delete() 里那句「预置素材不能删除」永远走不到 —— 用户看到的是一句像 bug 的话。
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipAsset preset = ClipAsset.builder().id("ca_tail_story_v2").externalOwnerId(null).kind("video")
                .label("为实体发声片尾").mimeType("video/mp4").cdnKey("clip/assets/tail.mp4").preset(true)
                .createdAt(Instant.now()).build();
        when(repo.findById("ca_tail_story_v2")).thenReturn(Optional.of(preset));
        ClipAssetService service = new ClipAssetService(repo, storage, new ClipProperties(),
                mock(FfmpegRunner.class), mock(ClipAssetThumbnailExtractor.class), mock(ClipTemplateService.class));

        assertThatThrownBy(() -> service.delete("owner-1", "ca_tail_story_v2"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("内置素材");
        verify(repo, never()).delete(any(ClipAsset.class));
        verify(storage, never()).delete(anyString());
    }

    @Test
    @DisplayName("别人的素材仍然按「查无此物」处理，不泄露它存在")
    void othersAssetStaysNotFound() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        ClipAsset other = ClipAsset.builder().id("ca_2").externalOwnerId("owner-2").kind("video")
                .mimeType("video/mp4").cdnKey("clip/assets/x.mp4").createdAt(Instant.now()).build();
        when(repo.findById("ca_2")).thenReturn(Optional.of(other));
        ClipAssetService service = new ClipAssetService(repo, mock(FileStorageService.class), new ClipProperties(),
                mock(FfmpegRunner.class), mock(ClipAssetThumbnailExtractor.class), mock(ClipTemplateService.class));

        assertThatThrownBy(() -> service.delete("owner-1", "ca_2"))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("不存在或无权访问");
    }
}
