package com.aistareco.aep.repository;

import com.aistareco.aep.model.PlatformConnection;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PlatformConnectionRepository extends JpaRepository<PlatformConnection, String> {
    List<PlatformConnection> findByUserIdOrderByConnectedAtDesc(String userId);
    List<PlatformConnection> findByTenantIdOrderByConnectedAtDesc(String tenantId);
    Optional<PlatformConnection> findByUserIdAndPlatformId(String userId, String platformId);
}
