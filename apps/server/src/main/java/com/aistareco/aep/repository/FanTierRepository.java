package com.aistareco.aep.repository;

import com.aistareco.aep.model.FanTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FanTierRepository extends JpaRepository<FanTier, String> {
}
