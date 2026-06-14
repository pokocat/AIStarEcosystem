package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaShort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaShortRepository extends JpaRepository<DramaShort, String> {

    List<DramaShort> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaShort> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);
}
