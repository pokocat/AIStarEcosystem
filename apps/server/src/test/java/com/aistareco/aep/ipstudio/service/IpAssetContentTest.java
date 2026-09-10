package com.aistareco.aep.ipstudio.service;

import com.aistareco.aep.ipstudio.IpStudioFixtures;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * 同源取素材原件（v0.196）。
 *
 * <p>这是个「拿 key 换**内容**」的端点 —— 比 v0.158 那个「拿 key 换签名 URL」的还敏感，
 * 归属闸必须真拦。类型按字节判：存量文件里有「key 写 .png、内容是 JPEG」的，
 * 按后缀发 Content-Type 的话下载下来还是打不开（用户实测报的就是这个）。
 */
class IpAssetContentTest {

    private static final String USER = "u-1";
    private final FileStorageService storage = IpStudioFixtures.storage();
    private final IpProjectService svc = new IpProjectService(
            new IpStudioFixtures.Projects().repo, new IpStudioFixtures.Runs().repo,
            new IpCatalogService(IpStudioFixtures.OM), IpStudioFixtures.templateResolver(),
            storage, IpStudioFixtures.props(), IpStudioFixtures.videoJobs(), IpStudioFixtures.OM);

    private Path tempWith(byte[] bytes) throws Exception {
        Path f = Files.createTempFile("ip-asset", ".bin");
        Files.write(f, bytes);
        f.toFile().deleteOnExit();
        return f;
    }

    private String myKey(String name) {
        return IpStudioFixtures.sourceKey(USER, name);
    }

    @Test
    void 内容是JPEG时按字节回_不听key的png后缀() throws Exception {
        // 这就是用户报的那个：key 写着 .png，内容其实是 JPEG
        when(storage.openForRead(anyString())).thenReturn(tempWith(new byte[]{
                (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}));
        var got = svc.readOwnedAsset(USER, myKey("looks-like.png"));
        assertEquals("image/jpeg", got.mime(), "按字节判应当是 JPEG");
        assertEquals("jpg", got.ext(), "下载后缀也要跟着字节走");
    }

    @Test
    void 真PNG照常识别() throws Exception {
        when(storage.openForRead(anyString())).thenReturn(tempWith(new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0, 0, 0, 0, 0}));
        assertEquals("image/png", svc.readOwnedAsset(USER, myKey("a.png")).mime());
    }

    @Test
    void 认不出的字节按key后缀兜底_视频不会被当成八位字节流() throws Exception {
        when(storage.openForRead(anyString())).thenReturn(tempWith(new byte[]{9, 9, 9, 9}));
        assertEquals("video/mp4", svc.readOwnedAsset(USER, myKey("clip.mp4")).mime());
    }

    @Test
    void 别人的key取不到内容() {
        BusinessException e = assertThrows(BusinessException.class,
                () -> svc.readOwnedAsset(USER, IpStudioFixtures.sourceKey("someone-else", "x.png")));
        assertEquals("IP_ASSET_KEY_INVALID", e.getCode(), e.getMessage());
    }

    @Test
    void 路径穿越取不到内容() {
        for (String bad : new String[]{"../etc/passwd", "/etc/passwd", "ipstudio_source/../../x.png"}) {
            assertThrows(BusinessException.class, () -> svc.readOwnedAsset(USER, bad), bad);
        }
    }

    @Test
    void 文件没了报404而不是500() throws Exception {
        when(storage.openForRead(anyString())).thenThrow(new RuntimeException("no source for key"));
        BusinessException e = assertThrows(BusinessException.class, () -> svc.readOwnedAsset(USER, myKey("gone.png")));
        assertEquals("IP_ASSET_NOT_FOUND", e.getCode());
    }
}
