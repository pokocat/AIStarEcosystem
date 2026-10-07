package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaShort;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface DramaShortRepository extends JpaRepository<DramaShort, String> {

    List<DramaShort> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaShort> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);

    /**
     * 悲观行锁版（同 {@code WalletRepository#findByUserIdForUpdate} 的模式）：
     * 用户整页保存（saveShort）与配音 / 总装 worker 把结果写回 payloadJson 时，
     * 都是「读整份 → 改 → 写整份」。三者若不串行化就会 lost update ——
     * worker 拿着几十秒 / 几分钟前（隔着 TTS / ffmpeg 外部调用）读到的旧快照整份覆盖，
     * 会把用户这期间的自动保存悄悄抹掉（与 ClipProject.payloadJson 同类）。
     * 凡是要把结果 merge 回 payloadJson 的写路径，必须用这个锁定读，且在 {@code @Transactional} 内调用；
     * 锁随事务提交/回滚释放。外部调用（TTS / ffmpeg）永远在事务之外先跑完，只有最后一小步 merge 上锁。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM DramaShort s WHERE s.id = :id AND s.ownerUserId = :ownerUserId AND s.deletedAt IS NULL")
    Optional<DramaShort> findByIdAndOwnerUserIdAndDeletedAtIsNullForUpdate(@Param("id") String id,
                                                                          @Param("ownerUserId") String ownerUserId);

    /** 回收站列表：已软删的短视频草稿，按删除时间倒序。 */
    List<DramaShort> findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String ownerUserId);

    /** 不区分软删状态按归属取（恢复 / 彻底删除用）。 */
    Optional<DramaShort> findByIdAndOwnerUserId(String id, String ownerUserId);

    /** 软删早于 cutoff 的草稿（定时物理清理用）。 */
    List<DramaShort> findByDeletedAtBefore(OffsetDateTime cutoff);

    /**
     * 开拍付费创建的幂等查重（v0.145）：按 (owner, clientRequestId) 直查，
     * 与唯一索引 {@code uk_drama_short_owner_client_req} 同一组键。
     * **不过滤软删**：唯一索引覆盖全部行，回收站里的行也必须能被查到，
     * 否则会撞索引却查不到对手。
     */
    Optional<DramaShort> findFirstByOwnerUserIdAndClientRequestId(String ownerUserId, String clientRequestId);
}
