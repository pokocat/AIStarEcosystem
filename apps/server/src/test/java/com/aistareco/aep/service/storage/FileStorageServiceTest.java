package com.aistareco.aep.service.storage;

import com.aistareco.aep.config.FileStorageProperties;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * 离线验证统一文件存储门面 —— 不连真 OSS。
 *
 * 用 mock CdnUploader 代替真 driver（阿里云官方 SDK 同样推荐 mock OSS client 做单测）：
 * 验证门面的 key 约定 / 本地暂存 / keepLocalCopy 生命周期 / 签名委托 / 删除 等编排逻辑。
 * 真 driver（putObject 走网络）那一薄层由 AliyunOssCdnUploaderSmokeTest（配 env 才跑）覆盖。
 */
class FileStorageServiceTest {

    private FileStorageProperties props(Path dir, boolean keepLocal) {
        FileStorageProperties p = new FileStorageProperties();
        p.setLocalDir(dir.toString());
        p.setPublicUrlBase("/static/files");
        p.setSignedUrlTtlSeconds(3600);
        p.setKeepLocalCopy(keepLocal);
        return p;
    }

    @Test
    void store_buildsConventionKey_uploads_andSigns(@TempDir Path dir) throws Exception {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("oss");
        when(cdn.publicUrlFor(any())).thenAnswer(i -> "https://cdn.test/" + i.getArgument(0));
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey(any())).thenAnswer(i -> "https://cdn.test/" + i.getArgument(0) + "?sig=x");

        FileStorageService svc = new FileStorageService(props(dir, true), cdn, signer);

        var stored = svc.store("hello".getBytes(), "mixcut-assets", "u1", "png", "image/png");

        // key 约定 <category>/<owner>/<uuid>.<ext>
        assertThat(stored.key()).matches("^mixcut-assets/u1/[0-9a-f]{32}\\.png$");
        assertThat(stored.bytes()).isEqualTo(5);
        assertThat(stored.contentType()).isEqualTo("image/png");
        // 本地暂存确实落盘（keepLocalCopy=true）
        assertThat(stored.localPath()).isNotNull();
        assertThat(Files.exists(Path.of(stored.localPath()))).isTrue();
        // 推了 CDN（用约定 key + contentType）
        verify(cdn).upload(any(Path.class), eq(stored.key()), eq("image/png"));
        // 出 wire 是签名 URL
        assertThat(stored.signedUrl()).isEqualTo("https://cdn.test/" + stored.key() + "?sig=x");
    }

    @Test
    void store_keepLocalFalse_deletesLocalAfterUpload(@TempDir Path dir) throws Exception {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("oss");
        when(cdn.publicUrlFor(any())).thenReturn("https://cdn.test/x");
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey(any())).thenReturn("https://cdn.test/x?sig=x");

        FileStorageService svc = new FileStorageService(props(dir, false), cdn, signer);
        var stored = svc.store("v".getBytes(), "material-video", null, "mp4", "video/mp4");

        // keepLocalCopy=false → 上传后删本地，localPath 为空（纯 OSS 终态）
        assertThat(stored.localPath()).isNull();
        // 无 owner → key 不含 owner 段
        assertThat(stored.key()).matches("^material-video/[0-9a-f]{32}\\.mp4$");
    }

    @Test
    void storeExisting_deleteAfter_removesSource(@TempDir Path dir) throws Exception {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("oss");
        when(cdn.upload(any(), any(), any())).thenAnswer(i ->
                new CdnUploader.CdnUploadResult("https://cdn.test/" + i.getArgument(1),
                        i.getArgument(1), 8L, java.time.Instant.now()));
        when(cdn.publicUrlFor(any())).thenReturn("https://cdn.test/x");
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey(any())).thenReturn("https://cdn.test/x?sig=x");
        FileStorageService svc = new FileStorageService(props(dir, true), cdn, signer);

        Path src = Files.writeString(dir.resolve("render-out.mp4"), "rendered");
        var stored = svc.storeExisting(src, "mixcut", "job1", "mp4", "video/mp4", /*deleteAfter=*/true);

        assertThat(Files.exists(src)).isFalse();        // 上传后删本地源
        assertThat(stored.localPath()).isNull();
        verify(cdn).upload(eq(src), eq(stored.key()), eq("video/mp4"));
    }

    @Test
    void noCdn_fallsBackToStaticUrl_andKeepsLocal(@TempDir Path dir) {
        // cdn 为 null（driver 配错 / 未注入）→ 走本机静态兜底 URL，文件保留
        FileStorageService svc = new FileStorageService(props(dir, false), null, CdnUrlSigner.NOOP);
        var stored = svc.store("img".getBytes(), "celebrity/avatar", null, "jpg", "image/jpeg");

        assertThat(stored.url()).isEqualTo("/static/files/" + stored.key());
        assertThat(stored.localPath()).isNotNull();      // 无 CDN 必须保留本地，否则无处可读
        assertThat(Files.exists(Path.of(stored.localPath()))).isTrue();
    }

    @Test
    void delete_removesCdnObjectAndLocal(@TempDir Path dir) throws Exception {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("oss");
        when(cdn.publicUrlFor(any())).thenReturn("https://cdn.test/x");
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey(any())).thenReturn("https://cdn.test/x?sig=x");
        FileStorageService svc = new FileStorageService(props(dir, true), cdn, signer);

        var stored = svc.store("z".getBytes(), "mixcut-assets", "u1", "png", "image/png");
        svc.delete(stored.key());

        verify(cdn).delete(stored.key());
        assertThat(Files.exists(Path.of(stored.localPath()))).isFalse();
    }
}
