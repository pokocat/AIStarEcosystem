package com.aistareco.aep.repository;

import com.aistareco.aep.model.GenerationJob;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GenerationJobRepository extends JpaRepository<GenerationJob, String> {
}
