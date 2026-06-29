package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaBrainstorm;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaBrainstormRepository extends JpaRepository<DramaBrainstorm, String> {

    List<DramaBrainstorm> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaBrainstorm> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);
}
