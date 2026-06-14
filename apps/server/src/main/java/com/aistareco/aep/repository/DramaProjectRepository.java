package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaProject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaProjectRepository extends JpaRepository<DramaProject, String> {

    List<DramaProject> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaProject> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);

    /** 运营「从用户作品精选」候选池：任意用户、已铺大纲（stage≥N）的最近项目。 */
    List<DramaProject> findTop80ByDeletedAtIsNullAndStageGreaterThanEqualOrderByUpdatedAtDesc(int stage);

    /** 运营邀请精选时按 id 取项目（不限归属）。 */
    Optional<DramaProject> findByIdAndDeletedAtIsNull(String id);
}
