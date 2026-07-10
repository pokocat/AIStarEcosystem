package com.aistareco.aep.repository;

import com.aistareco.aep.model.AiAppEndpointCandidate;
import com.aistareco.aep.model.AiModelPurpose;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiAppEndpointCandidateRepository extends JpaRepository<AiAppEndpointCandidate, String> {

    /** 某用途的全部候选端点，按展示排序（默认端点 sortOrder=0 置顶）。 */
    List<AiAppEndpointCandidate> findByPurposeOrderBySortOrderAscCreatedAtAsc(AiModelPurpose purpose);

    /** 白名单查询：purpose × endpointId 唯一（含停用；调用方自行 filter enabled）。 */
    Optional<AiAppEndpointCandidate> findByPurposeAndEndpointId(AiModelPurpose purpose, String endpointId);

    boolean existsByPurposeAndEndpointId(AiModelPurpose purpose, String endpointId);
}
