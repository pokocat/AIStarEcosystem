package com.aistareco.aep.videostudio;

import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.aep.service.storage.StorageQuotaService;
import com.aistareco.aep.videostudio.dto.VideoStudioDtos.VideoStudioUpload;
import com.aistareco.aep.videostudio.service.VideoStudioUploadService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * 素材上传（docs/video-studio-plan.md §5.5）：类型 → 空 / 大小 → 按字节判格式 → ffprobe（临时文件用完即删）
 * → 配额 → 落存储（分类 = 验过的类型，后缀 = 判出来的格式）→ 记用量。断错误码，不断文案。
 */
class VideoStudioUploadServiceTest {

    private FileStorageService fileStorage;
    private StorageQuotaService quota;
    private FfmpegRunner ffmpeg;
    private VideoStudioUploadService svc;
    private final List<File> probedFiles = new ArrayList<>();

    @BeforeEach
    void setUp() {
        fileStorage = mock(FileStorageService.class);
        quota = mock(StorageQuotaService.class);
        ffmpeg = mock(FfmpegRunner.class);
        svc = new VideoStudioUploadService(fileStorage, quota, ffmpeg);
        when(fileStorage.store(any(byte[].class), anyString(), anyString(), anyString(), anyString())).thenAnswer(i -> {
            byte[] data = i.getArgument(0);
            String key = i.getArgument(1) + "/" + i.getArgument(2) + "/0123456789abcdef0123456789abcdef." + i.getArgument(3);
            return new FileStorageService.StoredFile(key, "https://cdn.test/" + key, null, null, data.length, i.getArgument(4));
        });
        when(fileStorage.signedUrl(anyString())).thenAnswer(i -> "https://cdn.test/" + i.getArgument(0) + "?sig=1");
    }

    private void probeReturns(FfmpegRunner.MediaProbe probe) {
        when(ffmpeg.probeMedia(any(File.class))).thenAnswer(i -> {
            File f = i.getArgument(0);
            assertTrue(f.exists(), "探测时临时文件应当在");
            probedFiles.add(f);
            return probe;
        });
    }

    private static byte[] head(int size, int... bytes) {
        byte[] b = new byte[size];
        for (int i = 0; i < bytes.length; i++) b[i] = (byte) bytes[i];
        return b;
    }

    private static byte[] realPng(int w, int h) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB), "png", out);
        return out.toByteArray();
    }

    private static MultipartFile file(String name, byte[] bytes) {
        return new MockMultipartFile("file", name, "application/octet-stream", bytes);
    }

    private String code(MultipartFile f, String mediaType) {
        BusinessException e = assertThrows(BusinessException.class, () -> svc.upload("u1", f, mediaType));
        verify(fileStorage, never()).store(any(byte[].class), anyString(), anyString(), anyString(), anyString());
        return e.getCode();
    }

    @Test
    @DisplayName("图片：按字节判格式（JPEG 顶着 .png 也存成 jpg），分类 video-studio-image，像素从文件头读")
    void imageUpload() throws Exception {
        byte[] png = realPng(640, 360);
        VideoStudioUpload up = svc.upload("u1", file("C:\\fakepath\\封面.webp", png), "image");

        assertEquals("image", up.mediaType());
        assertEquals("video-studio-image/u1/0123456789abcdef0123456789abcdef.png", up.key());
        assertEquals("https://cdn.test/" + up.key() + "?sig=1", up.url());
        assertEquals(png.length, up.bytes());
        assertEquals("封面.webp", up.name());
        assertEquals(640, up.width());
        assertEquals(360, up.height());
        assertNull(up.durationSec());
        verify(fileStorage).store(any(byte[].class), eq("video-studio-image"), eq("u1"), eq("png"), eq("image/png"));
        verify(quota).checkQuota("celebrity", "u1", png.length);
        verify(quota).record(eq("celebrity"), eq("u1"), eq("视频生成素材"), isNull(), eq(up.key()), eq((long) png.length));
        verify(ffmpeg, never()).probeMedia(any());

        svc.upload("u1", file("x.png", head(64, 0xFF, 0xD8, 0xFF, 0xE0)), "image");
        verify(fileStorage).store(any(byte[].class), eq("video-studio-image"), eq("u1"), eq("jpg"), eq("image/jpeg"));
    }

    @Test
    @DisplayName("音频：2–15 秒放行，时长回给前端；ffprobe 用的临时文件探完即删")
    void audioUpload() {
        probeReturns(new FfmpegRunner.MediaProbe(7.25, "mp3", null, "mp3", 0, 0, 44100, 2, true));
        VideoStudioUpload up = svc.upload("u1", file("voice.mp3", head(64, 'I', 'D', '3', 4)), "audio");

        assertEquals(7.25, up.durationSec());
        assertNull(up.width());
        assertTrue(up.key().startsWith("video-studio-audio/u1/"));
        verify(fileStorage).store(any(byte[].class), eq("video-studio-audio"), eq("u1"), eq("mp3"), eq("audio/mpeg"));
        assertEquals(1, probedFiles.size());
        assertTrue(probedFiles.get(0).getName().endsWith(".mp3"));
        assertFalse(probedFiles.get(0).exists(), "临时文件应当已删除");
    }

    @Test
    @DisplayName("视频：MP4 且有画面轨；像素与时长从 ffprobe 来")
    void videoUpload() {
        probeReturns(new FfmpegRunner.MediaProbe(4.5, "mov,mp4,m4a,3gp,3g2,mj2", "h264", "aac", 720, 1280, 44100, 2, true));
        VideoStudioUpload up = svc.upload("u1",
                file("clip.mov", head(64, 0, 0, 0, 0x20, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm')), "video");

        assertEquals("video", up.mediaType());
        assertEquals(720, up.width());
        assertEquals(1280, up.height());
        assertEquals(4.5, up.durationSec());
        verify(fileStorage).store(any(byte[].class), eq("video-studio-video"), eq("u1"), eq("mp4"), eq("video/mp4"));
        assertFalse(probedFiles.get(0).exists());
    }

    @Test
    @DisplayName("类型不是 image / video / audio → VIDEO_STUDIO_FORMAT_UNSUPPORTED；空文件 → VIDEO_STUDIO_FILE_EMPTY")
    void typeAndEmpty() {
        assertEquals("VIDEO_STUDIO_FORMAT_UNSUPPORTED", code(file("a.png", head(64, 0x89, 'P', 'N', 'G')), "document"));
        assertEquals("VIDEO_STUDIO_FORMAT_UNSUPPORTED", code(file("a.png", head(64, 0x89, 'P', 'N', 'G')), null));
        assertEquals("VIDEO_STUDIO_FILE_EMPTY", code(null, "image"));
        assertEquals("VIDEO_STUDIO_FILE_EMPTY", code(file("a.png", new byte[0]), "image"));
    }

    @Test
    @DisplayName("超过该类上限（图 30MB / 视频 50MB / 音频 15MB）→ VIDEO_STUDIO_FILE_TOO_LARGE")
    void tooLarge() {
        assertEquals("VIDEO_STUDIO_FILE_TOO_LARGE",
                code(file("a.mp3", head(15 * 1024 * 1024 + 1, 'I', 'D', '3', 4)), "audio"));
        assertEquals("VIDEO_STUDIO_FILE_TOO_LARGE",
                code(file("a.png", head(30 * 1024 * 1024 + 1, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)), "image"));
    }

    @Test
    @DisplayName("按字节判不是允许的格式 → VIDEO_STUDIO_FORMAT_UNSUPPORTED：GIF 图、MOV 视频、改了后缀的图当音频")
    void formatByBytes() {
        assertEquals("VIDEO_STUDIO_FORMAT_UNSUPPORTED", code(file("a.png", head(64, 'G', 'I', 'F', '8', '9', 'a')), "image"));
        assertEquals("VIDEO_STUDIO_FORMAT_UNSUPPORTED",
                code(file("a.mp4", head(64, 0, 0, 0, 0x14, 'f', 't', 'y', 'p', 'q', 't', ' ', ' ')), "video"));
        assertEquals("VIDEO_STUDIO_FORMAT_UNSUPPORTED",
                code(file("a.mp3", head(64, 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)), "audio"));
    }

    @Test
    @DisplayName("ffprobe 读不出 / 视频没有画面 / 音频没有声音 → VIDEO_STUDIO_MEDIA_UNREADABLE")
    void unreadableMedia() {
        byte[] mp4 = head(64, 0, 0, 0, 0x20, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm');
        probeReturns(new FfmpegRunner.MediaProbe(0, "", null, null, 0, 0, 0, 0, false));
        assertEquals("VIDEO_STUDIO_MEDIA_UNREADABLE", code(file("a.mp4", mp4), "video"));

        probeReturns(new FfmpegRunner.MediaProbe(5, "mp4", null, "aac", 0, 0, 44100, 2, true));
        assertEquals("VIDEO_STUDIO_MEDIA_UNREADABLE", code(file("a.mp4", mp4), "video"));

        probeReturns(new FfmpegRunner.MediaProbe(5, "mp4", "h264", null, 720, 1280, 0, 0, true));
        assertEquals("VIDEO_STUDIO_MEDIA_UNREADABLE", code(file("a.m4a", mp4), "audio"));
        probedFiles.forEach(f -> assertFalse(f.exists(), "失败时临时文件也要删"));
    }

    @Test
    @DisplayName("单段音频不在 2–15 秒 → VIDEO_STUDIO_AUDIO_DURATION_INVALID")
    void audioDuration() {
        byte[] wav = "RIFF____WAVEfmt ________________________".getBytes();
        probeReturns(new FfmpegRunner.MediaProbe(1.9, "wav", null, "pcm_s16le", 0, 0, 44100, 2, true));
        assertEquals("VIDEO_STUDIO_AUDIO_DURATION_INVALID", code(file("a.wav", wav), "audio"));
        probeReturns(new FfmpegRunner.MediaProbe(15.2, "wav", null, "pcm_s16le", 0, 0, 44100, 2, true));
        assertEquals("VIDEO_STUDIO_AUDIO_DURATION_INVALID", code(file("a.wav", wav), "audio"));
    }

    @Test
    @DisplayName("存储空间满：配额闸在落存储之前，原样抛 402 STORAGE_QUOTA_EXCEEDED")
    void quotaCheckedBeforeStore() {
        doThrow(new BusinessException(HttpStatus.PAYMENT_REQUIRED, "STORAGE_QUOTA_EXCEEDED", "存储空间已满"))
                .when(quota).checkQuota(eq("celebrity"), eq("u1"), anyLong());
        assertEquals("STORAGE_QUOTA_EXCEEDED", code(file("a.jpg", head(64, 0xFF, 0xD8, 0xFF, 0xE0)), "image"));
        verify(quota, never()).record(any(), any(), any(), any(), any(), anyLong());
    }

    @Test
    @DisplayName("展示用文件名：去路径、去控制字符；没有就按类型给默认名")
    void displayNames() throws Exception {
        assertEquals("图片", svc.upload("u1", file("", realPng(2, 2)), "image").name());
        assertEquals("a b.png", svc.upload("u1", file("dir/a\u0007 b.png", realPng(2, 2)), "image").name());
    }

    @Test
    @DisplayName("分类名只有一个出处：video-studio-<类型>")
    void categoryName() {
        assertEquals("video-studio-audio", VideoStudioUploadService.categoryOf("audio"));
        assertEquals("video-studio-image", VideoStudioUploadService.categoryOf("image"));
    }
}
