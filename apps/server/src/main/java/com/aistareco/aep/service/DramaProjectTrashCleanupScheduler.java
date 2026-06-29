package com.aistareco.aep.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 短剧回收站到期清理 —— 每日 03:40 物理删除软删超过保留期
 * （{@link DramaProjectService#TRASH_RETENTION_DAYS} 天，默认 30）的短剧项目。
 *
 * 多实例部署需 ShedLock（沿用 DapTrashCleanupScheduler / PublishJobScheduler 同样的待办）。
 */
@Component
public class DramaProjectTrashCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(DramaProjectTrashCleanupScheduler.class);

    private final DramaProjectService service;

    public DramaProjectTrashCleanupScheduler(DramaProjectService service) {
        this.service = service;
    }

    @Scheduled(cron = "0 40 3 * * *")
    public void purgeExpiredTrash() {
        try {
            service.purgeExpiredTrash();
        } catch (Exception e) {
            log.warn("[drama-trash] scheduled purge failed: {}", e.getMessage());
        }
    }
}
