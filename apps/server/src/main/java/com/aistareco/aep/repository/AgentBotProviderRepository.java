package com.aistareco.aep.repository;

import com.aistareco.aep.model.AgentBotProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentBotProviderRepository extends JpaRepository<AgentBotProvider, String> {

    Optional<AgentBotProvider> findBySceneKeyAndEnabledTrue(String sceneKey);

    Optional<AgentBotProvider> findBySceneKey(String sceneKey);

    List<AgentBotProvider> findAllByOrderBySceneKeyAsc();
}
