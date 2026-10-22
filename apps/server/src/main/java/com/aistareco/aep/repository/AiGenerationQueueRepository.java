package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiGenerationQueueEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface AiGenerationQueueRepository extends JpaRepository<AiGenerationQueueEntry,Long> {
    Optional<AiGenerationQueueEntry> findByTaskTypeAndTaskId(String type,String id);
    long countByEndpointIdAndState(String endpoint,String state);
    /** Review-only receipts retain their hold and route, but are not executable concurrency. */
    @org.springframework.data.jpa.repository.Query("""
        select count(q) from AiGenerationQueueEntry q
        where q.endpointId=:endpoint and q.state='running'
          and not exists (select r.id from IpRun r where r.id=q.taskId and q.taskType='ip-image'
            and r.kind='generate' and r.status='running' and r.stage='image.provider.recovering'
            and r.errorCode='STUDIO_IMAGE_SUBMISSION_UNKNOWN')
          and not exists (select v.id from MaterialVideoJob v where v.id=q.taskId and q.taskType='material-video'
            and v.status='submitting' and v.errorCode='VIDEO_SUBMISSION_UNKNOWN'
            and (v.externalTaskId is null or trim(v.externalTaskId)=''))
          and not exists (select r.id from IpRun r where r.id=q.taskId and q.taskType='ip-speech'
            and r.status='running' and
              ((r.kind='studio-audio' and r.stage='audio.submission_unknown' and r.errorCode='STUDIO_SPEECH_SUBMISSION_UNKNOWN')
                or (r.kind='studio-lip-sync' and r.stage='lip-sync.submission_unknown' and r.errorCode='STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN')))
        """)
    long countOccupyingSlots(@org.springframework.data.repository.query.Param("endpoint") String endpoint);
    /** Submission alerts are a projection of retained receipts, including automatically failed/refunded tasks. */
    @org.springframework.data.jpa.repository.Query("""
        select q from AiGenerationQueueEntry q where (
          exists (select v.id from MaterialVideoJob v where v.id=q.taskId and q.taskType='material-video'
            and v.errorCode='VIDEO_SUBMISSION_UNKNOWN'
            and (v.externalTaskId is null or trim(v.externalTaskId)=''))
          or exists (select r.id from IpRun r where r.id=q.taskId
            and ((q.taskType='ip-image' and r.errorCode='STUDIO_IMAGE_SUBMISSION_UNKNOWN')
              or (q.taskType='ip-speech' and r.errorCode in ('STUDIO_SPEECH_SUBMISSION_UNKNOWN','STUDIO_LIP_SYNC_SUBMISSION_UNKNOWN')))))
        order by q.id desc
        """)
    org.springframework.data.domain.Page<AiGenerationQueueEntry> findNeedingAttention(org.springframework.data.domain.Pageable page);
    long countByEndpointIdAndStateAndIdLessThan(String endpoint,String state,Long id);
    List<AiGenerationQueueEntry> findByStateInOrderByIdAsc(Collection<String> states);
}
