package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapAvatar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapAvatarRepository extends JpaRepository<DapAvatar, String> {
    /**
     * 乐观认领：只有 demoAttempts 仍等于我读到的那个值时才 +1。
     *
     * 同仓的 ClipRenderWorker 用租约，说明这套服务是**按多实例部署考虑的**。
     * 没有这道 CAS，两台机器会同时给同一条记录生成样例 —— 白烧一份石榴点数，
     * 而且后写的会覆盖先写的 key，先写那份成了没人引用的孤儿文件。
     *
     * 返回 0 表示别人抢到了，本轮直接跳过，下一轮它已经有样例、自然不再被选中。
     */
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update DapAvatar a set a.demoAttempts = :next where a.id = :id and a.demoAttempts = :expected and a.demoVideoCdnKey is null")
    int claimDemo(@org.springframework.data.repository.query.Param("id") String id,
                  @org.springframework.data.repository.query.Param("expected") Integer expected,
                  @org.springframework.data.repository.query.Param("next") Integer next);

    List<DapAvatar> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);
    List<DapAvatar> findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId, String engine);
    Optional<DapAvatar> findByIdAndOwnerUserId(String id, String ownerUserId);
    List<DapAvatar> findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String ownerUserId);
    List<DapAvatar> findByDeletedAtBefore(java.time.Instant cutoff);
    Optional<DapAvatar> findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId, String engine);
    /** 跨 owner 全量：供运营后台与供应商侧对账（ClipVendorService），业务链路不要用。 */
    List<DapAvatar> findByEngineAndDeletedAtIsNull(String engine);
}
