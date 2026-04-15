package com.aistareco.aep.repository;

import com.aistareco.aep.model.FeatureConfig;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FeatureConfigRepository extends JpaRepository<FeatureConfig, String> {

    Optional<FeatureConfig> findByConfigKey(String configKey);

    Page<FeatureConfig> findByConfigGroup(String configGroup, Pageable pageable);

    List<FeatureConfig> findByConfigKeyStartingWithAndIsActiveTrue(String prefix);

    List<FeatureConfig> findByIsActiveTrue();
}
