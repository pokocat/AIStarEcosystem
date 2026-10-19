package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiGenerationQueueEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AiGenerationQueueRepository extends JpaRepository<AiGenerationQueueEntry,Long> {
    Optional<AiGenerationQueueEntry> findByTaskTypeAndTaskId(String type,String id);
    long countByEndpointIdAndState(String endpoint,String state);
    long countByEndpointIdAndStateAndIdLessThan(String endpoint,String state,Long id);
    List<AiGenerationQueueEntry> findByStateInOrderByIdAsc(Collection<String> states);
}
