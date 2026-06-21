package com.aistareco.aep.repository;

import com.aistareco.aep.model.GenerationJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

public interface GenerationJobRepository extends JpaRepository<GenerationJob, String> {

    /** Atomic CAS: set committed=true only if still false. Returns 1 on win, 0 if already committed. */
    @Modifying
    @Transactional
    @Query("UPDATE GenerationJob j SET j.committed = true WHERE j.id = :id AND j.committed = false")
    int markCommitted(@Param("id") String id);
}
