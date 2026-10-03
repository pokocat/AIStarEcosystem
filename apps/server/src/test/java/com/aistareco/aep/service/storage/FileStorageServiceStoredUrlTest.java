package com.aistareco.aep.service.storage;

import com.aistareco.aep.config.FileStorageProperties;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** 把我方存储给出去的地址反解回 key：OSS 域名交给签名器认，本机 fake CDN 按驱动自己的公开前缀剥。 */
class FileStorageServiceStoredUrlTest {

    private FileStorageService svc(Path dir, CdnUploader cdn, CdnUrlSigner signer) {
        FileStorageProperties p = new FileStorageProperties();
        p.setLocalDir(dir.toString());
        p.setPublicUrlBase("/static/files");
        return new FileStorageService(p, cdn, signer);
    }

    @Test
    @DisplayName("OSS：签名器认得出的直接用")
    void ossUrlGoesThroughSigner(@TempDir Path dir) {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("oss");
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.keyOf("https://cdn.example/media/material-videos/j1/video.mp4?Expires=1"))
                .thenReturn("media/material-videos/j1/video.mp4");
        assertThat(svc(dir, cdn, signer).keyOfStoredUrl("https://cdn.example/media/material-videos/j1/video.mp4?Expires=1"))
                .isEqualTo("media/material-videos/j1/video.mp4");
    }

    @Test
    @DisplayName("本机 fake CDN（dev 没配 OSS 域名，签名器认不出）：按驱动的公开前缀剥，去掉查询串")
    void localFakeCdnFallsBackToDriverBase(@TempDir Path dir) {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("local");
        when(cdn.publicUrlFor(any())).thenAnswer(i -> "http://localhost:8080/cdn/" + i.getArgument(0));
        FileStorageService storage = svc(dir, cdn, CdnUrlSigner.NOOP);

        assertThat(storage.keyOfStoredUrl("http://localhost:8080/cdn/material-videos/j1/video.mp4?t=1#x"))
                .isEqualTo("material-videos/j1/video.mp4");
        assertThat(storage.keyOfStoredUrl("https://elsewhere.example/material-videos/j1/video.mp4")).isNull();
        assertThat(storage.keyOfStoredUrl("http://localhost:8080/cdn/../etc/passwd")).isNull();
        assertThat(storage.keyOfStoredUrl(null)).isNull();
        assertThat(storage.keyOfStoredUrl(" ")).isNull();
    }

    @Test
    @DisplayName("没有 CDN：按本机静态前缀剥")
    void noCdnUsesStaticBase(@TempDir Path dir) {
        assertThat(svc(dir, null, CdnUrlSigner.NOOP).keyOfStoredUrl("/static/files/video-studio-image/u1/a.png"))
                .isEqualTo("video-studio-image/u1/a.png");
    }
}
