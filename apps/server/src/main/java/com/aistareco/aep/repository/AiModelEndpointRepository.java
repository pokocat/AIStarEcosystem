package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiModelEndpoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiModelEndpointRepository extends JpaRepository<AiModelEndpoint, String> {

    List<AiModelEndpoint> findByEnabledTrue();

    List<AiModelEndpoint> findAllByOrderByCreatedAtDesc();
}
