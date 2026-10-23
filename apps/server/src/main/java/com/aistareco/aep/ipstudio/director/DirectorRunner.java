package com.aistareco.aep.ipstudio.director;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 导演台的后台推进：关了页面也会把完成的结果放进作品、继续一键制作（§8）。
 * 只扫有在跑任务或连跑的作品；每个作品在自己的事务里持行锁处理，一个出错不影响别的。
 */
@Component
public class DirectorRunner {
    private static final Logger log = LoggerFactory.getLogger(DirectorRunner.class);
    private final DirectorWorkRepository works;
    private final DirectorService director;

    public DirectorRunner(DirectorWorkRepository works, DirectorService director) {
        this.works = works;
        this.director = director;
    }

    @Scheduled(initialDelayString = "${aep.director.initial-delay-ms:20000}", fixedDelayString = "${aep.director.scan-ms:3000}")
    public void scan() {
        for (String id : works.activeIds()) {
            try { director.tick(id); }
            catch (RuntimeException e) { log.warn("[director] 推进失败 work={} reason={}", id, e.toString()); }
        }
    }
}
