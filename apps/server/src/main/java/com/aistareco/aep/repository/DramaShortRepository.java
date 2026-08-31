package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaShort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface DramaShortRepository extends JpaRepository<DramaShort, String> {

    List<DramaShort> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaShort> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);

    /** 回收站列表：已软删的短视频草稿，按删除时间倒序。 */
    List<DramaShort> findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String ownerUserId);

    /** 不区分软删状态按归属取（恢复 / 彻底删除用）。 */
    Optional<DramaShort> findByIdAndOwnerUserId(String id, String ownerUserId);

    /** 软删早于 cutoff 的草稿（定时物理清理用）。 */
    List<DramaShort> findByDeletedAtBefore(OffsetDateTime cutoff);

    /**
     * 该账号在 since 之后新建的草稿（新 → 旧）。用于「开拍付费创建」的幂等查重：
     * 幂等键存在 payloadJson 里（没有独立列，见 TODO.md 迁移编号漂移），
     * 靠时间窗把要读的 payload 数量限住，不做全量扫。
     */
    List<DramaShort> findByOwnerUserIdAndDeletedAtIsNullAndCreatedAtAfterOrderByCreatedAtDesc(
            String ownerUserId, OffsetDateTime since);
}
