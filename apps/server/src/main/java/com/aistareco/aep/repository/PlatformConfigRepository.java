package com.aistareco.aep.repository;

import com.aistareco.aep.model.PlatformConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PlatformConfigRepository extends JpaRepository<PlatformConfig, String> {
    Optional<PlatformConfig> findByConfigKey(String configKey);
    boolean existsByConfigKey(String configKey);
}
