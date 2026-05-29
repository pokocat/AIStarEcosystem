package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiModelEndpoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AiModelEndpointRepository extends JpaRepository<AiModelEndpoint, String> {

    List<AiModelEndpoint> findByEnabledTrue();

    /** 网关 Key 验证：按前 12 位 prefix 索引检索候选。 */
    List<AiModelEndpoint> findByKeyPrefix(String keyPrefix);

    List<AiModelEndpoint> findAllByOrderByCreatedAtDesc();
}
