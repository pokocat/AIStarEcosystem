package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.repository.ClipAssetRepository;
import com.aistareco.aep.clip.service.ClipAssetService;
import com.aistareco.aep.clip.service.ClipTemplateService;
import com.aistareco.aep.clip.service.ClipAssetThumbnailExtractor;
import com.aistareco.aep.service.mixcut.FfmpegRunner;
import com.aistareco.aep.service.storage.FileStorageService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 素材库总容量闸。
 *
 * 单文件大小合规不代表还装得下 —— 没有总量校验时用户可以无限上传，
 * 存储成本没有上界，而用户是在磁盘写满之后才发现问题。
 */
class ClipAssetQuotaTest {

    private ClipAssetService serviceWith(ClipAssetRepository repo, ClipProperties props, FileStorageService storage) {
        return new ClipAssetService(repo, storage, props, mock(FfmpegRunner.class),
                mock(ClipAssetThumbnailExtractor.class), mock(ClipTemplateService.class));
    }

    @Test
    @DisplayName("总量超限时拒绝上传，且在落盘之前就拒（不留孤儿文件）")
    void rejectsWhenOverQuota() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipProperties props = new ClipProperties();
        props.setMaxOwnerAssetBytes(1000);
        when(repo.sumBytesByOwner("owner-1")).thenReturn(900L);

        var file = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[200]);

        assertThatThrownBy(() -> serviceWith(repo, props, storage).upload("owner-1", file, "video", null, false, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("空间不够");
        // 关键：不能先写文件再回滚
        verify(storage, never()).store(any(), anyString(), anyString());
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("刚好装得下要放行")
    void allowsWhenExactlyFits() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        ClipProperties props = new ClipProperties();
        props.setMaxOwnerAssetBytes(1000);
        when(repo.sumBytesByOwner("owner-1")).thenReturn(800L);
        var file = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[200]);

        // 落盘之后的链路不是本用例关注点，用抛错断言"闸已放行"
        FileStorageService storage = mock(FileStorageService.class);
        when(storage.store(any(), anyString(), anyString())).thenThrow(new IllegalStateException("passed-quota-gate"));

        assertThatThrownBy(() -> serviceWith(repo, props, storage).upload("owner-1", file, "video", null, false, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("passed-quota-gate");
    }

    @Test
    @DisplayName("预置素材由平台提供，不占用户配额")
    void presetBypassesOwnerQuota() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        ClipProperties props = new ClipProperties();
        props.setMaxOwnerAssetBytes(10);
        var file = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[200]);
        FileStorageService storage = mock(FileStorageService.class);
        when(storage.store(any(), anyString(), anyString())).thenThrow(new IllegalStateException("passed-quota-gate"));

        assertThatThrownBy(() -> serviceWith(repo, props, storage).upload("admin", file, "video", null, true, null))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("passed-quota-gate");
        verify(repo, never()).sumBytesByOwner(anyString());
    }

    @Test
    @DisplayName("汇总返回已用、上限与条数，供端上显示容量条")
    void storageSummary() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        ClipProperties props = new ClipProperties();
        props.setMaxOwnerAssetBytes(2048);
        when(repo.sumBytesByOwner("owner-1")).thenReturn(512L);
        when(repo.countByExternalOwnerIdAndDeletedAtIsNull("owner-1")).thenReturn(3L);

        var summary = serviceWith(repo, props, mock(FileStorageService.class)).storage("owner-1");

        assertThat(summary.usedBytes()).isEqualTo(512L);
        assertThat(summary.limitBytes()).isEqualTo(2048L);
        assertThat(summary.count()).isEqualTo(3L);
    }
}
