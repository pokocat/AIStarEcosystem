package com.aistareco.aep.repository;

import com.aistareco.aep.model.EventRsvp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EventRsvpRepository extends JpaRepository<EventRsvp, EventRsvp.Key> {
    List<EventRsvp> findByUserId(String userId);
    List<EventRsvp> findByEventId(String eventId);
    Optional<EventRsvp> findByEventIdAndUserId(String eventId, String userId);
    long countByEventId(String eventId);
}
