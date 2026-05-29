package com.aistareco.aep.repository;

import com.aistareco.aep.model.MaterialScript;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialScriptRepository extends JpaRepository<MaterialScript, String> {
    List<MaterialScript> findAllByOrderByOrdAsc();
}
