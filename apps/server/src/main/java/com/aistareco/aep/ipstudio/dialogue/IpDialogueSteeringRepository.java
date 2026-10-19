package com.aistareco.aep.ipstudio.dialogue;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface IpDialogueSteeringRepository extends JpaRepository<IpDialogueSteering, String> {
    List<IpDialogueSteering> findByThreadIdAndStatusOrderByCreatedAtAscIdAsc(String threadId, String status);
    Optional<IpDialogueSteering> findByMessageId(String messageId);
    /** Steering bound to a plan execution (sent while it was running), oldest first; served by the thread_id index prefix. */
    List<IpDialogueSteering> findByThreadIdAndExecutionIdOrderByCreatedAtAscIdAsc(String threadId, String executionId);
}
