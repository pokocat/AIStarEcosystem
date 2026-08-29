package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapAvatar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapAvatarRepository extends JpaRepository<DapAvatar, String> {
    List<DapAvatar> findByOwnerUserId(String ownerUserId);
    List<DapAvatar> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);
    List<DapAvatar> findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId, String engine);
    Optional<DapAvatar> findByIdAndOwnerUserId(String id, String ownerUserId);
    List<DapAvatar> findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String ownerUserId);
    List<DapAvatar> findByDeletedAtBefore(java.time.Instant cutoff);
    Optional<DapAvatar> findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId, String engine);
    /** 跨 owner 全量：供运营后台与供应商侧对账（ClipVendorService），业务链路不要用。 */
    List<DapAvatar> findByEngineAndDeletedAtIsNull(String engine);
}
