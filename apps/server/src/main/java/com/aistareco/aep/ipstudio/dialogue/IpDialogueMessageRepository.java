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

    /** Per-thread message count and last message time for one user's threads on one canvas (the 「历史对话」 list). */
    interface ThreadMessageStats { String getThreadId(); long getMessageCount(); java.time.Instant getLastAt(); }

    @Query("select m.threadId as threadId, count(m) as messageCount, max(m.createdAt) as lastAt from IpDialogueMessage m "
            + "where m.threadId in (select t.id from IpDialogueThread t where t.projectId = :projectId and t.ownerUserId = :ownerUserId) "
            + "group by m.threadId")
    List<ThreadMessageStats> statsByCanvas(@Param("projectId") String projectId, @Param("ownerUserId") String ownerUserId);

    interface ThreadFirstText { String getThreadId(); String getText(); }

    /** The first user message with text in each given thread (one row per thread at most; seq is unique per thread). */
    @Query("select m.threadId as threadId, m.text as text from IpDialogueMessage m where m.threadId in :threadIds and m.role = 'user' "
            + "and m.seq = (select min(f.seq) from IpDialogueMessage f where f.threadId = m.threadId and f.role = 'user' and length(f.text) > 0)")
    List<ThreadFirstText> firstUserTexts(@Param("threadIds") java.util.Collection<String> threadIds);
}
