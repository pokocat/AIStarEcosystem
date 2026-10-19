package com.aistareco.aep.ipstudio.dialogue;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;

public interface IpDialogueEventRepository extends JpaRepository<IpDialogueEvent, String> {
    List<IpDialogueEvent> findByThreadIdAndSeqGreaterThanOrderBySeqAsc(String threadId, long afterSeq, Pageable page);

    @Query("select max(e.seq) from IpDialogueEvent e where e.threadId = :threadId and e.createdAt < :before")
    Long maxSeqBefore(@Param("threadId") String threadId, @Param("before") Instant before);

    @Query("select distinct e.threadId from IpDialogueEvent e where e.createdAt < :before")
    List<String> threadsWithEventsBefore(@Param("before") Instant before, Pageable page);

    @Modifying
    @Query("delete from IpDialogueEvent e where e.threadId = :threadId and e.seq <= :seq")
    int deleteThrough(@Param("threadId") String threadId, @Param("seq") long seq);
}
