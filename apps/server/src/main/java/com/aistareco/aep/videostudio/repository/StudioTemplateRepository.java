package com.aistareco.aep.videostudio.repository;

import com.aistareco.aep.videostudio.model.StudioTemplate;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface StudioTemplateRepository extends JpaRepository<StudioTemplate, String> {

    /** 当前用户看得到的模板：在架的官方模板 + 自己的（官方的自己发的也算），新 → 旧。 */
    @Query("select t from StudioTemplate t where t.status = 'active' "
            + "and (t.scope = 'official' or t.ownerUserId = :uid) order by t.createdAt desc")
    List<StudioTemplate> findVisible(@Param("uid") String userId, Pageable page);

    /** 「做同款」成功建出任务时 +1：单条 UPDATE 自增，不读改写（并发做同款不会丢计数）。 */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Transactional
    @Query("update StudioTemplate t set t.useCount = t.useCount + 1 where t.id = :id")
    int incrementUseCount(@Param("id") String id);
}
