package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiGenerationQueueEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AiGenerationQueueRepository extends JpaRepository<AiGenerationQueueEntry,Long> {
    Optional<AiGenerationQueueEntry> findByTaskTypeAndTaskId(String type,String id);
    long countByEndpointIdAndState(String endpoint,String state);
    /** Unknown image submissions retain their receipt/hold, but cannot execute without operator evidence. */
    @org.springframework.data.jpa.repository.Query("""
        select count(q) from AiGenerationQueueEntry q
        where q.endpointId=:endpoint and q.state='running'
          and not exists (select r.id from IpRun r where r.id=q.taskId and q.taskType='ip-image'
            and r.kind='generate' and r.status='running' and r.stage='image.provider.recovering'
            and r.errorCode='STUDIO_IMAGE_SUBMISSION_UNKNOWN')
        """)
    long countOccupyingSlots(@org.springframework.data.repository.query.Param("endpoint") String endpoint);
    long countByEndpointIdAndStateAndIdLessThan(String endpoint,String state,Long id);
    List<AiGenerationQueueEntry> findByStateInOrderByIdAsc(Collection<String> states);
}
