package com.aistareco.aep.clip;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.repository.ClipAssetRepository;
import com.aistareco.aep.clip.repository.ClipRenderJobRepository;
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

    private ClipRenderJobRepository jobs = mock(ClipRenderJobRepository.class);

    private ClipAssetService serviceWith(ClipAssetRepository repo, ClipProperties props, FileStorageService storage) {
        return new ClipAssetService(repo, storage, props, mock(FfmpegRunner.class),
                mock(ClipAssetThumbnailExtractor.class), mock(ClipTemplateService.class), jobs);
    }


    @Test
    @DisplayName("总量超限时拒绝上传，且在落盘之前就拒（不留孤儿文件）")
    void rejectsWhenOverQuota() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipProperties props = new ClipProperties();
        // 配额与占用都按整 MB 计（见 ClipAssetService.ceilMb）：字节级的配额已经没有意义。
        long mb = 1024L * 1024L;
        props.setMaxOwnerAssetBytes(3 * mb);
        when(repo.sumBytesByOwner("owner-1")).thenReturn(3 * mb);

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
        long mb = 1024L * 1024L;
        props.setMaxOwnerAssetBytes(3 * mb);
        // 已用 2MB（取整后），再传一个不足 1MB 的文件 → 正好 3MB，放行。
        when(repo.sumBytesByOwner("owner-1")).thenReturn(2 * mb);
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
    @DisplayName("已用 = 素材 + 成片：只数素材会让容量条撒谎")
    void storageSummaryCountsWorksToo() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        ClipProperties props = new ClipProperties();
        props.setMaxOwnerAssetBytes(2048);
        long mb = 1024L * 1024L;
        props.setMaxOwnerAssetBytes(200 * mb);
        when(repo.sumBytesByOwner("owner-1")).thenReturn(2 * mb + 300_000L);   // 2.3MB 素材
        when(jobs.sumOutputBytesByOwner("owner-1")).thenReturn(4 * mb + 100L); // 4.0001MB 成片
        when(repo.countByExternalOwnerIdAndDeletedAtIsNull("owner-1")).thenReturn(3L);

        var summary = serviceWith(repo, props, mock(FileStorageService.class)).storage("owner-1", 0);

        // 素材与作品共用一份额度（2026-08-14 产品口径）。只算素材，用户会看着「还剩很多」
        // 而磁盘早被成片吃满 —— 容量条说的必须是真实占用。
        // 取整按**总量**：2.3 + 4.0001 = 6.3001MB → 7MB。
        assertThat(summary.usedBytes()).isEqualTo(7 * mb);
        assertThat(summary.count()).isEqualTo(3L);
    }

    @Test
    @DisplayName("上层传下来的扩容额度优先于默认额度；不传或非正数才回落默认")
    void quotaOverrideWins() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        ClipProperties props = new ClipProperties();
        props.setMaxOwnerAssetBytes(2048);
        var service = serviceWith(repo, props, mock(FileStorageService.class));

        // 钻石扩容的权益归军师管（钻石在那边），这里只认它算好的有效额度。
        assertThat(service.storage("owner-1", 9999).limitBytes()).isEqualTo(9999L);
        assertThat(service.storage("owner-1", 0).limitBytes()).isEqualTo(2048L);
        assertThat(service.storage("owner-1", -1).limitBytes()).isEqualTo(2048L);
    }

    @Test
    @DisplayName("配额闸也要按「素材 + 成片」判，否则条子没满却传不上去")
    void quotaGateCountsWorksToo() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        FileStorageService storage = mock(FileStorageService.class);
        ClipProperties props = new ClipProperties();
        long mb = 1024L * 1024L;
        props.setMaxOwnerAssetBytes(3 * mb);
        // 素材 1MB + 成片 2MB = 3MB，已经顶格；只数素材的话会误判为「还剩 2MB」而放行。
        when(repo.sumBytesByOwner("owner-1")).thenReturn(mb);
        when(jobs.sumOutputBytesByOwner("owner-1")).thenReturn(2 * mb);

        var file = new MockMultipartFile("file", "a.mp4", "video/mp4", new byte[200]);

        assertThatThrownBy(() -> serviceWith(repo, props, storage).upload("owner-1", file, "video", null, false, null))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("空间不够");
        verify(storage, never()).store(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("取整按总量而不是按单文件：单文件取整会让一堆小图凭空吃掉半个额度")
    void roundsTotalNotEachFile() {
        long mb = 1024L * 1024L;
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        ClipProperties props = new ClipProperties();
        props.setMaxOwnerAssetBytes(200 * mb);
        // 100 张 200KB 的照片 ≈ 19.5MB。按单文件取整会算成 100MB —— 在 200MB 的额度下
        // 等于凭空吃掉一半。取整只为让数字干净，不该变成一种隐性涨价。
        when(repo.sumBytesByOwner("owner-1")).thenReturn(100 * 200_000L);
        when(jobs.sumOutputBytesByOwner("owner-1")).thenReturn(0L);

        var summary = serviceWith(repo, props, mock(FileStorageService.class)).storage("owner-1", 0);

        assertThat(summary.usedBytes()).isEqualTo(20 * mb);
        assertThat(summary.usedBytes()).isLessThan(25 * mb);
    }

    @Test
    @DisplayName("空账号显示 0，不是「已用 1MB」")
    void emptyAccountShowsZero() {
        ClipAssetRepository repo = mock(ClipAssetRepository.class);
        when(repo.sumBytesByOwner("owner-1")).thenReturn(0L);
        when(jobs.sumOutputBytesByOwner("owner-1")).thenReturn(0L);

        assertThat(serviceWith(repo, new ClipProperties(), mock(FileStorageService.class))
                .storage("owner-1", 0).usedBytes()).isEqualTo(0L);
    }
}
