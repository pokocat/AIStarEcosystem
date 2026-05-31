package com.aistareco.aep.repository;

import com.aistareco.aep.model.WorkshopScriptVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkshopScriptVersionRepository extends JpaRepository<WorkshopScriptVersion, String> {

    List<WorkshopScriptVersion> findByScriptIdOrderByVersionAsc(String scriptId);

    Optional<WorkshopScriptVersion> findFirstByScriptIdOrderByVersionDesc(String scriptId);

    void deleteByScriptId(String scriptId);
}
