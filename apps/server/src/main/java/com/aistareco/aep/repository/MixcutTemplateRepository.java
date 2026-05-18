package com.aistareco.aep.repository;

import com.aistareco.aep.model.MixcutTemplate;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MixcutTemplateRepository extends JpaRepository<MixcutTemplate, String> {

    Optional<MixcutTemplate> findByTemplateIdAndOwnerScope(String templateId, String ownerScope);

    List<MixcutTemplate> findByIsFactoryTrueOrderByUpdatedAtDesc();

    List<MixcutTemplate> findByOwnerUserIdOrderByUpdatedAtDesc(String ownerUserId);
}
