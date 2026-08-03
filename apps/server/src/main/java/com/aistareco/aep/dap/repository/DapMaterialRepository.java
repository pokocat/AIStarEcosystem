package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapMaterial;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface DapMaterialRepository extends JpaRepository<DapMaterial, String> {

    Optional<DapMaterial> findByIdAndOwnerUserId(String id, String ownerUserId);

    List<DapMaterial> findByRefTypeAndRefIdAndOwnerUserIdOrderByCreatedAtDesc(
            String refType, String refId, String ownerUserId);

    /** 轮询器收敛用（pending / reviewing 等非终态）。 */
    List<DapMaterial> findByStatusIn(Collection<String> statuses);
}
