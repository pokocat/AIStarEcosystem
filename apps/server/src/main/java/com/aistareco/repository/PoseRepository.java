package com.aistareco.repository;

import com.aistareco.model.Pose;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PoseRepository extends JpaRepository<Pose, String> {}
