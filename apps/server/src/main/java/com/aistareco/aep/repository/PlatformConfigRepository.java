package com.aistareco.aep.repository;

import com.aistareco.aep.model.PlatformConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface PlatformConfigRepository extends JpaRepository<PlatformConfig, String> {
    @org.springframework.data.jpa.repository.Query("select x from PlatformConfig x where trim(trailing from x.configKey) = trim(trailing from :configKey)")
    Optional<PlatformConfig> findByConfigKey(@org.springframework.data.repository.query.Param("configKey") String configKey);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select c from PlatformConfig c where trim(trailing from c.configKey) = trim(trailing from :key)")
    Optional<PlatformConfig> lockByConfigKey(@org.springframework.data.repository.query.Param("key") String key);
    @org.springframework.data.jpa.repository.Query("select count(x) > 0 from PlatformConfig x where trim(trailing from x.configKey) = trim(trailing from :configKey)")
    boolean existsByConfigKey(@org.springframework.data.repository.query.Param("configKey") String configKey);
}
