package com.aistareco.aep.repository;

import com.aistareco.aep.model.FanGrowthPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FanGrowthPointRepository extends JpaRepository<FanGrowthPoint, String> {
}
