package com.aistareco.aep.ipstudio.dialogue;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface IpDialogueMessageRepository extends JpaRepository<IpDialogueMessage, String> {
    Optional<IpDialogueMessage> findByThreadIdAndClientMessageId(String threadId, String clientMessageId);
    List<IpDialogueMessage> findByThreadIdOrderBySeqDesc(String threadId, Pageable page);
    List<IpDialogueMessage> findByThreadIdAndSeqLessThanOrderBySeqDesc(String threadId, long seq, Pageable page);
    List<IpDialogueMessage> findByThreadIdAndSeqLessThanEqualOrderBySeqAsc(String threadId, long seq);
    List<IpDialogueMessage> findByThreadIdAndSeqGreaterThanOrderBySeqAsc(String threadId, long seq, Pageable page);
    boolean existsByThreadIdAndSeqLessThan(String threadId, long seq);

    @Query("select distinct m.legacyNodeId from IpDialogueMessage m where m.threadId = :threadId and m.legacyNodeId is not null")
    List<String> importedLegacyNodeIds(@Param("threadId") String threadId);
}
