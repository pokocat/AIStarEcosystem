package com.aistareco.aep.repository;

import com.aistareco.aep.model.PlanFeatureOverride;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PlanFeatureOverrideRepository extends JpaRepository<PlanFeatureOverride, String> {

    Optional<PlanFeatureOverride> findByPlanIdAndConfigKeyAndIsActiveTrue(String planId, String configKey);
}
