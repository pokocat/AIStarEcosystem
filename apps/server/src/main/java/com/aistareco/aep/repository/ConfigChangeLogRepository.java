package com.aistareco.aep.repository;

import com.aistareco.aep.model.ConfigChangeLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ConfigChangeLogRepository extends JpaRepository<ConfigChangeLog, String> {

    List<ConfigChangeLog> findByConfigKeyOrderByCreatedAtDesc(String configKey);
}
