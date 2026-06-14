package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaRecipe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DramaRecipeRepository extends JpaRepository<DramaRecipe, String> {

    Optional<DramaRecipe> findByIdAndDeletedAtIsNull(String id);

    Optional<DramaRecipe> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);

    /** 某用户抽取/提交的配方。 */
    List<DramaRecipe> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    /** 按状态（运营审核队列 / 已发布创意库）。 */
    List<DramaRecipe> findByStatusAndDeletedAtIsNullOrderByUpdatedAtDesc(String status);

    /** 候选项目是否已抽过配方（运营精选去重）。 */
    List<DramaRecipe> findBySourceProjectIdInAndDeletedAtIsNull(Collection<String> sourceProjectIds);
}
