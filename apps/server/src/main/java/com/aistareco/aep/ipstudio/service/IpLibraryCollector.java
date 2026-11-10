package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.*;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
/** Durable reconciliation: index failures never resubmit models or change task settlement. */
@Component
public class IpLibraryCollector {
    private static final Logger log=LoggerFactory.getLogger(IpLibraryCollector.class);
    private static final Duration DIRECTOR_RETRY=Duration.ofMinutes(5);
    private final IpRunRepository runs;private final IpLibraryService library;private final IpLibraryDirectorSync directorSync;private int page;private int directorPage;
    private final Map<String,Instant> directorRetryAfter=new ConcurrentHashMap<>();
    public IpLibraryCollector(IpRunRepository runs,IpLibraryService library,IpLibraryDirectorSync directorSync){this.runs=runs;this.library=library;this.directorSync=directorSync;}
    @Scheduled(fixedDelayString="${aep.ipstudio.library-collect-delay:5000}",initialDelay=10000)
    public void collect(){var batch=runs.uncollectedLibraryRuns(org.springframework.data.domain.PageRequest.of(page,50));page=batch.size()==50?page+1:0;for(var run:batch)try{library.collect(run);}catch(Exception e){log.warn("[asset-library] retry indexing run={} reason={}",run.getId(),e.getClass().getSimpleName());}}
    /** 导演台的角色、场景、道具。出错的作品隔 5 分钟再试，不每轮刷日志；页往后翻，出错的不会一直占着前面的位置。 */
    @Scheduled(fixedDelayString="${aep.ipstudio.library-director-sync-delay:10000}",initialDelay=15000)
    public void syncDirectorWorks(){
        var batch=directorSync.pending(directorPage);directorPage=batch.size()==directorSync.batchSize()?directorPage+1:0;
        Instant now=Instant.now();directorRetryAfter.values().removeIf(at->at.isBefore(now));
        for(var target:batch){
            if(directorRetryAfter.containsKey(target.workId()))continue;
            try{directorSync.sync(target);}catch(Exception e){directorRetryAfter.put(target.workId(),now.plus(DIRECTOR_RETRY));log.warn("[asset-library] retry director work={} reason={}",target.workId(),e.toString());}
        }
    }
}
