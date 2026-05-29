package com.aistareco.aep.repository;

import com.aistareco.aep.model.PromptTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, String> {
    Optional<PromptTemplate> findByPromptKey(String promptKey);
    boolean existsByPromptKey(String promptKey);
}
