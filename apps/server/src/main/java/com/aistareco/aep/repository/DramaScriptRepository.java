package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaScript;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaScriptRepository extends JpaRepository<DramaScript, String> {

    List<DramaScript> findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerUserId);

    Optional<DramaScript> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);

    /** v0.45：一部多集短剧的所有集，按集号升序。 */
    List<DramaScript> findByOwnerUserIdAndSeriesIdAndDeletedAtIsNullOrderByEpisodeNoAsc(String ownerUserId, String seriesId);
}
