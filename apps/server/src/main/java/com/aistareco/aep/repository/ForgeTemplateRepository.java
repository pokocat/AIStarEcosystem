package com.aistareco.aep.repository;

import com.aistareco.aep.model.ForgeTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ForgeTemplateRepository extends JpaRepository<ForgeTemplate, String> {
}
