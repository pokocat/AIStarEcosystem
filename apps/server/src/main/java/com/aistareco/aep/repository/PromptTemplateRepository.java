package com.aistareco.aep.repository;

import com.aistareco.aep.model.PromptTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;

import java.util.Optional;

public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, String> {
    @org.springframework.data.jpa.repository.Query("select x from PromptTemplate x where trim(trailing from x.promptKey) = trim(trailing from :promptKey)")
    Optional<PromptTemplate> findByPromptKey(@org.springframework.data.repository.query.Param("promptKey") String promptKey);
    @Modifying(clearAutomatically = true)
    @Query("""
        UPDATE PromptTemplate p SET p.systemPrompt = :system, p.userTemplate = :user,
          p.paramsJson = :params, p.enabled = :enabled, p.version = p.version + 1,
          p.updatedAt = :at, p.updatedBy = :by
        WHERE trim(trailing from p.promptKey) = trim(trailing from :key) AND p.version = :expected
        """)
    int updateIfVersion(@Param("key") String key, @Param("expected") int expected,
                        @Param("system") String system, @Param("user") String user,
                        @Param("params") String params, @Param("enabled") boolean enabled,
                        @Param("at") Instant at, @Param("by") String by);
    @org.springframework.data.jpa.repository.Query("select count(x) > 0 from PromptTemplate x where trim(trailing from x.promptKey) = trim(trailing from :promptKey)")
    boolean existsByPromptKey(@org.springframework.data.repository.query.Param("promptKey") String promptKey);
}
