package com.aistareco.aep.repository;

import com.aistareco.aep.model.FanActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FanActivityRepository extends JpaRepository<FanActivity, String> {
}
