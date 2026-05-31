package com.aistareco.aep.repository;

import com.aistareco.aep.model.WorkshopScript;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkshopScriptRepository extends JpaRepository<WorkshopScript, String> {

    List<WorkshopScript> findByOwnerUserIdOrderByUpdatedAtDesc(String ownerUserId);

    Optional<WorkshopScript> findByIdAndOwnerUserId(String id, String ownerUserId);
}
