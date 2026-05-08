package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiModelProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiModelProviderRepository extends JpaRepository<AiModelProvider, String> {

    List<AiModelProvider> findByEnabledTrueOrderByPriorityAsc();
}
