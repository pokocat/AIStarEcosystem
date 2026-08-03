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

    /**
     * 同一真人资产复用已经 active 的 liveness 分组。avatarId 在当前产品中就是真人主体边界；
     * 新素材只需挂到同一个 qgroupid 逐条审核，不应每次录制都重新刷脸、重新占用上游分组配额。
     */
    Optional<DapMaterialGroup> findFirstByAvatarIdAndOwnerUserIdAndKindAndModelAndStatusAndRecycledAtIsNullOrderByCreatedAtDesc(
            String avatarId, String ownerUserId, String kind, String model, String status);

    /** 轮询器收敛用（preparing / validating 等非终态）。 */
    List<DapMaterialGroup> findByStatusIn(Collection<String> statuses);

    /** 复用本用户既有的 aigc 分组（按 owner 维度；账号级共享组走 findByCallbackToken 的去重键）。 */
    Optional<DapMaterialGroup> findFirstByOwnerUserIdAndKindAndModelAndStatusOrderByCreatedAtDesc(
            String ownerUserId, String kind, String model, String status);

    /**
     * 终态分组回收器：某类分组里状态为 status、创建早于 before、尚未回收的行。
     * （active 分组不在回收范围 —— 那是生效授权的取证凭据。）
     */
    List<DapMaterialGroup> findByKindAndStatusAndRecycledAtIsNullAndCreatedAtBefore(
            String kind, String status, java.time.Instant before);
}
