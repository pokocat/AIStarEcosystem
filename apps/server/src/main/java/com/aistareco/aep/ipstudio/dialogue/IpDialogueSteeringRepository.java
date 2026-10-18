package com.aistareco.aep.ipstudio.dialogue;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface IpDialogueSteeringRepository extends JpaRepository<IpDialogueSteering, String> {
    List<IpDialogueSteering> findByThreadIdAndStatusOrderByCreatedAtAscIdAsc(String threadId, String status);
    Optional<IpDialogueSteering> findByMessageId(String messageId);
}
