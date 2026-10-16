package com.aistareco.aep.repository;

import com.aistareco.aep.model.PromptTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;

import java.util.Optional;

public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, String> {
    Optional<PromptTemplate> findByPromptKey(String promptKey);
    @Modifying(clearAutomatically = true)
    @Query("""
        UPDATE PromptTemplate p SET p.systemPrompt = :system, p.userTemplate = :user,
          p.paramsJson = :params, p.enabled = :enabled, p.version = p.version + 1,
          p.updatedAt = :at, p.updatedBy = :by
        WHERE p.promptKey = :key AND p.version = :expected
        """)
    int updateIfVersion(@Param("key") String key, @Param("expected") int expected,
                        @Param("system") String system, @Param("user") String user,
                        @Param("params") String params, @Param("enabled") boolean enabled,
                        @Param("at") Instant at, @Param("by") String by);
    boolean existsByPromptKey(String promptKey);
}
