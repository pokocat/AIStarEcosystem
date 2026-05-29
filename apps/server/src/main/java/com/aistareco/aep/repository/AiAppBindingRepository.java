package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiAppBinding;
import com.aistareco.aep.model.AiModelPurpose;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AiAppBindingRepository extends JpaRepository<AiAppBinding, AiModelPurpose> {

    /** 删端点前守卫：是否还有 AI 应用绑定到该端点。 */
    long countByEndpointId(String endpointId);
}
