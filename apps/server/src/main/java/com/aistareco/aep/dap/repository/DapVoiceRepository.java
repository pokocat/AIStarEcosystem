package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapVoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DapVoiceRepository extends JpaRepository<DapVoice, String> {
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
    @Query("update DapVoice v set v.demoAttempts = :next where v.id = :id and v.demoAttempts = :expected and v.demoAudioCdnKey is null")
    int claimDemo(@org.springframework.data.repository.query.Param("id") String id,
                  @org.springframework.data.repository.query.Param("expected") Integer expected,
                  @org.springframework.data.repository.query.Param("next") Integer next);

    List<DapVoice> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);
    Optional<DapVoice> findByIdAndOwnerUserId(String id, String ownerUserId);
    List<DapVoice> findByOwnerUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerUserId);
    List<DapVoice> findByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerUserId, String engine);
    Optional<DapVoice> findFirstByOwnerUserIdAndEngineAndDeletedAtIsNullOrderByCreatedAtDesc(String ownerUserId, String engine);
    /** 跨 owner 全量：供运营后台与供应商侧对账（ClipVendorService），业务链路不要用。 */
    List<DapVoice> findByEngineAndDeletedAtIsNull(String engine);
    @Query("SELECT COALESCE(SUM(v.bytes),0) FROM DapVoice v WHERE v.ownerUserId = :uid AND v.deletedAt IS NULL")
    long sumBytesByOwner(@Param("uid") String uid);
}
