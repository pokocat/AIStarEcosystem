package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaPlatformConnection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaPlatformConnectionRepository extends JpaRepository<DramaPlatformConnection, String> {
    List<DramaPlatformConnection> findByOwnerUserId(String ownerUserId);
    Optional<DramaPlatformConnection> findByOwnerUserIdAndPlatformId(String ownerUserId, String platformId);
}
