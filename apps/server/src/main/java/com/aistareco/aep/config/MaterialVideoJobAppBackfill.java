package com.aistareco.aep.config;

import com.aistareco.aep.repository.MaterialVideoJobRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * 一次性回填 {@code material_video_job.app}（子产品分区列，v0.108 新加）。
 *
 * <p>本表被明星带货线（素材运营）与短剧线（分镜 / 整集出片）共用，此前列表查询只按 owner 过滤，
 * 导致带货素材库里冒出短剧分镜视频、短剧任务中心里冒出带货视频。新写入的行由
 * {@code MaterialVideoJobService} 显式落 app；历史行本列为 null，这里按 kind 前缀
 * （{@code drama-shot} / {@code drama-episode} → drama，其余 → celebrity）补齐。
 *
 * <p>幂等：只更新 {@code app is null} 的行，重复启动是 0 行 UPDATE。
 */
@Component
@Order(70)
public class MaterialVideoJobAppBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MaterialVideoJobAppBackfill.class);

    private final MaterialVideoJobRepository jobRepo;

    public MaterialVideoJobAppBackfill(MaterialVideoJobRepository jobRepo) {
        this.jobRepo = jobRepo;
    }

    @Override
    public void run(String... args) {
        try {
            int updated = jobRepo.backfillAppFromKind();
            if (updated > 0) log.info("[material-video] backfilled app column on {} legacy job row(s)", updated);
        } catch (Exception e) {
            // 回填失败不阻断启动：查询本身对 app=null 的行也按 kind 前缀推断分区
            // （MaterialVideoJobRepository.APP_EXPR），只是走不到 (owner_user_id, app) 索引。
            log.warn("[material-video] app backfill failed: {}", e.getMessage());
        }
    }
}
