package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaProject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface DramaProjectRepository extends JpaRepository<DramaProject, String> {

    List<DramaProject> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaProject> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);

    /** 运营「从用户作品精选」候选池：任意用户、已铺大纲（stage≥N）的最近项目。 */
    List<DramaProject> findTop80ByDeletedAtIsNullAndStageGreaterThanEqualOrderByUpdatedAtDesc(int stage);

    /** 运营邀请精选时按 id 取项目（不限归属）。 */
    Optional<DramaProject> findByIdAndDeletedAtIsNull(String id);

    /** 回收站列表：当前用户已软删的项目，按删除时间倒序。 */
    List<DramaProject> findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String ownerUserId);

    /** 回收站恢复 / 彻底删除时按 id 取项目（不限软删状态，仍按归属校验）。 */
    Optional<DramaProject> findByIdAndOwnerUserId(String id, String ownerUserId);

    /** 到期清理：软删时间早于 cutoff 的项目（物理删除候选）。 */
    List<DramaProject> findByDeletedAtBefore(OffsetDateTime cutoff);
}
