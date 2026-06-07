package com.aistareco.aep.dap.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 数字人回收站到期清理 —— 每日 03:50 物理删除软删超过保留期（默认 30 天，
 * aep.dap.trash-retention-days）的数字人及其全部关联行 / 存储文件。
 *
 * 多实例部署需 ShedLock（沿用 PublishJobScheduler / MixcutOutputCleanupScheduler 同样的待办）。
 */
@Component
public class DapTrashCleanupScheduler {

    private static final Logger log = LoggerFactory.getLogger(DapTrashCleanupScheduler.class);

    private final DapTrashService trashService;

    public DapTrashCleanupScheduler(DapTrashService trashService) {
        this.trashService = trashService;
    }

    @Scheduled(cron = "0 50 3 * * *")
    public void purgeExpiredTrash() {
        try {
            trashService.purgeExpired();
        } catch (Exception e) {
            log.warn("[dap-trash] scheduled purge failed: {}", e.getMessage());
        }
    }
}
