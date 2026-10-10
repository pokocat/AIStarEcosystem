package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiModelEndpoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiModelEndpointRepository extends JpaRepository<AiModelEndpoint, String> {

    List<AiModelEndpoint> findByEnabledTrue();

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select e from AiModelEndpoint e where e.id = :id")
    java.util.Optional<AiModelEndpoint> lockById(@org.springframework.data.repository.query.Param("id") String id);

    List<AiModelEndpoint> findAllByOrderByCreatedAtDesc();
}
