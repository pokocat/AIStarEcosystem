package com.aistareco.aep.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 短视频回收站到期清理 —— 每日 03:45 物理删除软删超过保留期
 * （{@link DramaShortService#TRASH_RETENTION_DAYS} 天，默认 30）的短视频草稿。
 *
 * 与 {@link DramaProjectTrashCleanupScheduler} 同惯例（错峰 5 分钟）。
 * 多实例部署需 ShedLock（沿用既有待办）。
 */
@Component
public class DramaShortTrashCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(DramaShortTrashCleanupScheduler.class);

    private final DramaShortService service;

    public DramaShortTrashCleanupScheduler(DramaShortService service) {
        this.service = service;
    }

    @Scheduled(cron = "0 45 3 * * *")
    public void purgeExpiredTrash() {
        try {
            service.purgeExpiredTrash();
        } catch (Exception e) {
            log.warn("[drama-short-trash] scheduled purge failed: {}", e.getMessage());
        }
    }
}
