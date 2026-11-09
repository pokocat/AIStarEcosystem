package com.aistareco.aep.ipstudio.history;

import com.aistareco.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * 存储上限检查，只管上传：用户自己传的图片、视频、音频超过账号存储上限时拒绝（402 STORAGE_QUOTA_EXCEEDED）。
 * 生成不拦：生成是付费动作，拦在生成会让已经报价、确认的任务半途失败。
 *
 * <p>开关 {@code aep.ipstudio.storage-enforce}，默认关闭（不改变现有行为）；打开前确认后台已配好 aiavatar 的存储配额与存储空间套餐。
 * 用量与账号页「存储用量」同一个口径（{@link StudioStorageService#usage}）。
 */
@Service
public class StudioStorageGuard {
    private static final long MIB = 1024L * 1024L;
    private final StudioStorageService storage;
    private final boolean enforce;

    public StudioStorageGuard(StudioStorageService storage, @Value("${aep.ipstudio.storage-enforce:false}") boolean enforce) {
        this.storage = storage;
        this.enforce = enforce;
    }

    public boolean enforced() { return enforce; }

    public void checkUpload(String user, long bytes) {
        if (!enforce || user == null || bytes <= 0) return;
        StudioStorageService.Usage usage = storage.usage(user);
        long addMb = (bytes + MIB - 1) / MIB;
        if (usage.usedMb() + addMb > usage.quotaMb())
            throw new BusinessException(HttpStatus.PAYMENT_REQUIRED, "STORAGE_QUOTA_EXCEEDED",
                    "存储空间已满（已用 " + usage.usedMb() + " MB，共 " + usage.quotaMb() + " MB）。请清理回收站或购买存储空间后再上传。");
    }
}
