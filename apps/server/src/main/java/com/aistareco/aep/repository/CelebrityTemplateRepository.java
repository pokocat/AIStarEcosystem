package com.aistareco.aep.repository;

import com.aistareco.aep.model.CelebrityTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CelebrityTemplateRepository extends JpaRepository<CelebrityTemplate, String> {
}
