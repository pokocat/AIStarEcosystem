package com.aistareco.aep.service.storage;

import com.aistareco.aep.config.FileStorageProperties;
import com.aistareco.aep.service.cdn.CdnUploader;
import com.aistareco.aep.service.cdn.CdnUrlSigner;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 归属闸用的 key 前缀必须与 store() 真实生成的 key 同一套 sanitize；
 * 交给上游去抓的地址先公开 URL、再签名 URL（与 DapImageInput.of 同一套取舍）。
 */
class FileStorageServiceKeyPrefixTest {

    private FileStorageService svc(Path dir, CdnUploader cdn, CdnUrlSigner signer) {
        FileStorageProperties p = new FileStorageProperties();
        p.setLocalDir(dir.toString());
        p.setPublicUrlBase("/static/files");
        p.setKeepLocalCopy(false);
        return new FileStorageService(p, cdn, signer);
    }

    @Test
    @DisplayName("ownedKeyPrefix 就是 store() 生成的 key 的前缀 —— 包括被 sanitize 的分类名与属主")
    void prefixMatchesStoredKeys(@TempDir Path dir) {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("oss");
        when(cdn.publicUrlFor(any())).thenAnswer(i -> "https://cdn.test/" + i.getArgument(0));
        FileStorageService storage = svc(dir, cdn, mock(CdnUrlSigner.class));

        var plain = storage.store("x".getBytes(), "video-studio-audio", "u_1", "wav", "audio/wav");
        assertThat(plain.key()).startsWith(FileStorageService.ownedKeyPrefix("video-studio-audio", "u_1"));
        assertThat(FileStorageService.ownedKeyPrefix("video-studio-audio", "u_1")).isEqualTo("video-studio-audio/u_1/");

        // 分类名里的 `/`、属主里的 `.` / `@` 都会被存储层换成 `_`：手拼的前缀对不上真实 key
        var odd = storage.store("x".getBytes(), "a/b", "user.name@x", "bin", "application/octet-stream");
        String prefix = FileStorageService.ownedKeyPrefix("a/b", "user.name@x");
        assertThat(prefix).isEqualTo("a_b/user_name_x/");
        assertThat(odd.key()).startsWith(prefix);
    }

    @Test
    @DisplayName("没有属主就没有归属前缀（否则会匹配到所有人的文件）")
    void prefixRequiresOwner() {
        assertThatThrownBy(() -> FileStorageService.ownedKeyPrefix("video-studio-image", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> FileStorageService.ownedKeyPrefix("video-studio-image", " "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("交给视频厂商的地址：签名 URL 优先（私有桶下未签名地址是 403；签名地址对公开桶同样有效）")
    void upstreamFetchUrlPrefersSignedUrl(@TempDir Path dir) {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("oss");
        // publicUrlFor 只是拼域名，不管桶能不能匿名读 —— 所以不能拿「它非空」当「能用」
        when(cdn.publicUrlFor("ipstudio_gen/u1/a.png")).thenReturn("https://cdn.test/ipstudio_gen/u1/a.png");
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey("ipstudio_gen/u1/a.png")).thenReturn("https://cdn.test/ipstudio_gen/u1/a.png?sig=1");

        assertThat(svc(dir, cdn, signer).upstreamFetchUrl("ipstudio_gen/u1/a.png"))
                .isEqualTo("https://cdn.test/ipstudio_gen/u1/a.png?sig=1");
    }

    @Test
    @DisplayName("签不出来（签名器没配 / 返回空）时退公开 URL；key 为空返回 null")
    void upstreamFetchUrlFallsBackToPublicUrl(@TempDir Path dir) {
        CdnUploader cdn = mock(CdnUploader.class);
        when(cdn.driverName()).thenReturn("oss");
        when(cdn.publicUrlFor("k/1.png")).thenReturn("https://cdn.test/k/1.png");
        CdnUrlSigner signer = mock(CdnUrlSigner.class);
        when(signer.signKey(any())).thenReturn("");
        FileStorageService storage = svc(dir, cdn, signer);

        // signedUrl 在签名器给空时自己会退到 cdn.publicUrlFor —— 结果仍是那个公开地址
        assertThat(storage.upstreamFetchUrl("k/1.png")).isEqualTo("https://cdn.test/k/1.png");
        assertThat(storage.upstreamFetchUrl(null)).isNull();
        assertThat(storage.upstreamFetchUrl(" ")).isNull();
    }
}
