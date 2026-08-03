package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapMaterialGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface DapMaterialGroupRepository extends JpaRepository<DapMaterialGroup, String> {

    Optional<DapMaterialGroup> findByIdAndOwnerUserId(String id, String ownerUserId);

    /** 刷脸回跳只带不可枚举的 state（= callbackToken），据此定位分组。 */
    Optional<DapMaterialGroup> findByCallbackToken(String callbackToken);

    Optional<DapMaterialGroup> findFirstByCaptureIdAndOwnerUserIdOrderByCreatedAtDesc(String captureId, String ownerUserId);

    /** 轮询器收敛用（preparing / validating 等非终态）。 */
    List<DapMaterialGroup> findByStatusIn(Collection<String> statuses);

    /** 复用本用户既有的 aigc 分组（当前实现不建本地 aigc 组，保留给后续按组隔离时使用）。 */
    Optional<DapMaterialGroup> findFirstByOwnerUserIdAndKindAndModelAndStatusOrderByCreatedAtDesc(
            String ownerUserId, String kind, String model, String status);
}
