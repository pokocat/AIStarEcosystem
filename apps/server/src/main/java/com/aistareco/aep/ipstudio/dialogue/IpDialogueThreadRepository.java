package com.aistareco.aep.ipstudio.dialogue;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface IpDialogueThreadRepository extends JpaRepository<IpDialogueThread, String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from IpDialogueThread t where t.id = :id")
    Optional<IpDialogueThread> lockById(@Param("id") String id);

    List<IpDialogueThread> findByProjectIdAndOwnerUserIdOrderByLastOpenedAtDescCreatedAtDesc(String projectId, String ownerUserId);

    Optional<IpDialogueThread> findByOwnerUserIdAndClientRequestId(String ownerUserId, String clientRequestId);

    List<IpDialogueThread> findByActiveRunIdIsNotNull();

    /** "Current thread" pointer per user and canvas: the most recently opened thread is what GET /conversation returns. */
    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.transaction.annotation.Transactional
    @Query("update IpDialogueThread t set t.lastOpenedAt = :now where t.id = :id")
    int markOpened(@Param("id") String id, @Param("now") java.time.Instant now);
}
