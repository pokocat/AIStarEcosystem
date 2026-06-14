package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaInteractiveSeries;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaInteractiveSeriesRepository extends JpaRepository<DramaInteractiveSeries, String> {

    List<DramaInteractiveSeries> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaInteractiveSeries> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);
}
