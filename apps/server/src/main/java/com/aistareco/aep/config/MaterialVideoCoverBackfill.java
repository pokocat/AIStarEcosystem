package com.aistareco.aep.config;

import com.aistareco.aep.model.MaterialVideoJob;
import com.aistareco.aep.repository.MaterialVideoJobRepository;
import com.aistareco.aep.service.materialvideo.MaterialVideoCover;
import com.aistareco.aep.service.storage.FileStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * v0.199.1 补封面：视频生成区（kind=studio-*）已成功、但还没有封面的任务，启动后在后台从成片补截一张。
 *
 * <p>新任务的封面由 worker 出片时就截好（{@link MaterialVideoCover}）；这里只管那之前的老任务，
 * 上线时线上就是 2026-10-03 真厂商实测的那四条。只补视频生成区：作品卡片和模板卡片都靠封面，
 * 别的分区（短剧、画布、带货素材）的界面不靠它，老任务不去动。
 *
 * <p>幂等：补上的行不会再被查到；截不出来的（成片没了 / 文件坏了）下次启动再试一次，只打 WARN。
 * 跑在后台线程上，不拖慢启动；每次最多 {@link #BATCH} 条。
 */
@Component
@Order(71)
public class MaterialVideoCoverBackfill implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(MaterialVideoCoverBackfill.class);

    static final int BATCH = 50;
    static final String STUDIO_KIND_PREFIX = "studio-";

    private final MaterialVideoJobRepository jobRepo;
    private final FileStorageService fileStorage;
    private final MaterialVideoCover cover;

    public MaterialVideoCoverBackfill(MaterialVideoJobRepository jobRepo, FileStorageService fileStorage,
                                      MaterialVideoCover cover) {
        this.jobRepo = jobRepo;
        this.fileStorage = fileStorage;
        this.cover = cover;
    }

    @Override
    public void run(String... args) {
        Thread t = new Thread(this::fillOnce, "material-video-cover-backfill");
        t.setDaemon(true);
        t.start();
    }

    /** 补一批，返回补上的条数。 */
    int fillOnce() {
        List<MaterialVideoJob> jobs;
        try {
            jobs = jobRepo.findCoverless(STUDIO_KIND_PREFIX, PageRequest.of(0, BATCH));
        } catch (Exception e) {
            log.warn("[material-video] cover backfill query failed: {}", e.getMessage());
            return 0;
        }
        if (jobs.isEmpty()) return 0;
        int filled = 0;
        for (MaterialVideoJob job : jobs) {
            String key = fileStorage.keyOfStoredUrl(job.getVideoUrl());
            if (key == null) {
                // 成片没镜像进我方存储（只留着厂商地址），那份地址多半早过期了，不去下
                log.warn("[material-video] cover backfill skip job={}: video is not in our storage", job.getId());
                continue;
            }
            try {
                Path local = fileStorage.openForRead(key);
                String url = cover.extractAndUpload(job.getId(), local);
                if (url != null && jobRepo.setThumbnailIfMissing(job.getId(), url, OffsetDateTime.now()) == 1) {
                    filled++;
                }
            } catch (Exception e) {
                log.warn("[material-video] cover backfill failed job={}: {}", job.getId(), e.getMessage());
            }
        }
        log.info("[material-video] cover backfill: filled {} of {} studio job(s) without a cover", filled, jobs.size());
        return filled;
    }
}
