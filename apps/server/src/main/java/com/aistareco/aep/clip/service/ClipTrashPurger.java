package com.aistareco.aep.clip.service;

import com.aistareco.aep.clip.config.ClipProperties;
import com.aistareco.aep.clip.repository.ClipProjectRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

/** 30 天回收站到期后删除项目、任务行和任务产物；用户素材不随项目误删。 */
@Component
public class ClipTrashPurger {
    private final ClipProjectRepository projects;
    private final ClipProjectService service;
    private final ClipProperties props;
    public ClipTrashPurger(ClipProjectRepository projects, ClipProjectService service, ClipProperties props) {
        this.projects = projects; this.service = service; this.props = props;
    }

    @Scheduled(fixedDelayString = "${aep.clip.trash-purge-delay-ms:3600000}")
    public void purge() {
        Instant cutoff = Instant.now().minus(Math.max(1, props.getTrashRetentionDays()), ChronoUnit.DAYS);
        projects.findTop100ByDeletedAtBeforeOrderByDeletedAtAsc(cutoff).forEach(service::purgeExpired);
    }
}
