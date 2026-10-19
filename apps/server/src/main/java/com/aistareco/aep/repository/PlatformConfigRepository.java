package com.aistareco.aep.repository;

import com.aistareco.aep.model.PlatformConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PlatformConfigRepository extends JpaRepository<PlatformConfig, String> {
    Optional<PlatformConfig> findByConfigKey(String configKey);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from PlatformConfig c where c.configKey = :key")
    Optional<PlatformConfig> lockByConfigKey(@org.springframework.data.repository.query.Param("key") String key);
    boolean existsByConfigKey(String configKey);
}
