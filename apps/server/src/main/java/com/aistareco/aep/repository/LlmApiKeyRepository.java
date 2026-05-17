package com.aistareco.aep.repository;

import com.aistareco.aep.model.LlmApiKey;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LlmApiKeyRepository extends JpaRepository<LlmApiKey, String> {

    List<LlmApiKey> findByKeyPrefix(String keyPrefix);

    List<LlmApiKey> findByUserIdOrderByCreatedAtDesc(String userId);

    List<LlmApiKey> findAllByOrderByCreatedAtDesc();
}
