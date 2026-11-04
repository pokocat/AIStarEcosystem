package com.aistareco.aep.repository;

import com.aistareco.aep.model.AgentBotProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AgentBotProviderRepository extends JpaRepository<AgentBotProvider, String> {

    @org.springframework.data.jpa.repository.Query("select x from AgentBotProvider x where trim(trailing from x.sceneKey)=trim(trailing from :sceneKey) and x.enabled=true")
    Optional<AgentBotProvider> findBySceneKeyAndEnabledTrue(String sceneKey);

    @org.springframework.data.jpa.repository.Query("select x from AgentBotProvider x where trim(trailing from x.sceneKey)=trim(trailing from :sceneKey)")
    Optional<AgentBotProvider> findBySceneKey(String sceneKey);

    List<AgentBotProvider> findAllByOrderBySceneKeyAsc();
}
