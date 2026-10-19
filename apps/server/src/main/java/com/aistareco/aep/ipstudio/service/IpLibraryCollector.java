package com.aistareco.aep.ipstudio.service;
import com.aistareco.aep.ipstudio.repository.IpRunRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.slf4j.*;
/** Durable reconciliation: index failures never resubmit models or change task settlement. */
@Component
public class IpLibraryCollector {
    private static final Logger log=LoggerFactory.getLogger(IpLibraryCollector.class);
    private final IpRunRepository runs;private final IpLibraryService library;private int page;
    public IpLibraryCollector(IpRunRepository runs,IpLibraryService library){this.runs=runs;this.library=library;}
    @Scheduled(fixedDelayString="${aep.ipstudio.library-collect-delay:5000}",initialDelay=10000)
    public void collect(){var batch=runs.uncollectedLibraryRuns(org.springframework.data.domain.PageRequest.of(page,50));page=batch.size()==50?page+1:0;for(var run:batch)try{library.collect(run);}catch(Exception e){log.warn("[asset-library] retry indexing run={} reason={}",run.getId(),e.getClass().getSimpleName());}}
}
