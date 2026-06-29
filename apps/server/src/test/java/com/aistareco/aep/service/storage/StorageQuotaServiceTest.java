package com.aistareco.aep.service.storage;

import com.aistareco.aep.dto.StorageUsageDto;
import com.aistareco.aep.model.StorageAsset;
import com.aistareco.aep.repository.StorageAssetRepository;
import com.aistareco.aep.repository.StorageGrantRepository;
import com.aistareco.aep.service.PlatformConfigService;
import com.aistareco.common.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * StorageQuotaService：记账幂等 / 用量 / 配额(基础+扩容) / 释放。仓库用 mock 背书。
 */
class StorageQuotaServiceTest {

    private static final long MB = 1024L * 1024L;

    private StorageAssetRepository assetRepo;
    private StorageGrantRepository grantRepo;
    private PlatformConfigService configs;
    private StorageQuotaService svc;

    @BeforeEach
    void setup() {
        assetRepo = mock(StorageAssetRepository.class);
        grantRepo = mock(StorageGrantRepository.class);
        configs = mock(PlatformConfigService.class);
        // 默认配置读取回落调用方默认值
        when(configs.getLong(anyString(), anyLong())).thenAnswer(inv -> inv.<Long>getArgument(1));
        svc = new StorageQuotaService(assetRepo, grantRepo, configs);
    }

    @Test
    void recordIsIdempotentByCdnKey() {
        when(assetRepo.existsByCdnKey("k1")).thenReturn(false);
        svc.record("drama", "u1", "成片", "p1", "k1", 5 * MB);
        verify(assetRepo, times(1)).save(any(StorageAsset.class));

        when(assetRepo.existsByCdnKey("k1")).thenReturn(true);
        svc.record("drama", "u1", "成片", "p1", "k1", 5 * MB);
        verify(assetRepo, times(1)).save(any(StorageAsset.class)); // 不重复保存
    }

    @Test
    void recordSkipsInvalidArgsAndNeverThrows() {
        assertDoesNotThrow(() -> svc.record("drama", "u1", "x", null, "k", 0)); // bytes<=0
        assertDoesNotThrow(() -> svc.record("drama", "u1", "x", null, null, 5)); // key null
        verify(assetRepo, never()).save(any());
    }

    @Test
    void quotaIsBasePlusActiveGrants() {
        when(configs.getLong(eq("storage.quota_mb.drama"), anyLong())).thenReturn(2000L);
        when(grantRepo.sumActiveMb(eq("drama"), eq("u1"), any())).thenReturn(3000L);
        assertEquals(2000L, svc.quotaMb("drama"));
        assertEquals(5000L, svc.quotaMb("drama", "u1")); // 基础 2000 + 扩容 3000
    }

    @Test
    void usageComputesRemainingAndBreakdown() {
        when(configs.getLong(eq("storage.quota_mb.drama"), anyLong())).thenReturn(1000L);
        when(grantRepo.sumActiveMb(eq("drama"), eq("u1"), any())).thenReturn(0L);
        when(assetRepo.sumBytes("drama", "u1")).thenReturn(300 * MB);
        when(assetRepo.sumBytesByCategory("drama", "u1")).thenReturn(List.<Object[]>of(
                new Object[]{"成片", 200 * MB},
                new Object[]{"分镜首帧", 100 * MB}
        ));
        StorageUsageDto u = svc.usage("drama", "u1");
        assertEquals(300, u.usedMb());
        assertEquals(1000, u.quotaMb());
        assertEquals(700, u.remainingMb());
        assertEquals(2, u.breakdown().size());
        assertEquals("成片", u.breakdown().get(0).category());
        assertEquals(200, u.breakdown().get(0).mb());
    }

    @Test
    void grantStorageIsIdempotentBySource() {
        when(grantRepo.existsBySource("ord1")).thenReturn(false);
        svc.grantStorage("drama", "u1", 1024, "ord1", null);
        verify(grantRepo, times(1)).save(any());

        when(grantRepo.existsBySource("ord1")).thenReturn(true);
        svc.grantStorage("drama", "u1", 1024, "ord1", null);
        verify(grantRepo, times(1)).save(any()); // 同一订单不重复授予
    }

    @Test
    void checkQuotaThrowsWhenOver() {
        when(configs.getLong(eq("storage.quota_mb.drama"), anyLong())).thenReturn(100L);
        when(grantRepo.sumActiveMb(eq("drama"), eq("u1"), any())).thenReturn(0L);
        when(assetRepo.sumBytes("drama", "u1")).thenReturn(99 * MB);
        assertThrows(BusinessException.class, () -> svc.checkQuota("drama", "u1", 5 * MB)); // 99+5 > 100
        assertDoesNotThrow(() -> svc.checkQuota("drama", "u1", 1 * MB)); // 99+1 = 100 ok
    }

    @Test
    void releaseByRefDelegatesToRepo() {
        svc.releaseByRef("drama", "p1");
        verify(assetRepo, times(1)).deleteByAppAndRefId("drama", "p1");
    }
}
