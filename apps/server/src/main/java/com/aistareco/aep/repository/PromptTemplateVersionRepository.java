package com.aistareco.aep.repository;

import com.aistareco.aep.model.PromptTemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface PromptTemplateVersionRepository extends JpaRepository<PromptTemplateVersion, String> {
    List<PromptTemplateVersion> findByPromptKeyOrderByVersionDesc(String promptKey);
    Optional<PromptTemplateVersion> findByPromptKeyAndVersion(String promptKey, int version);
}
