package com.aistareco.aep.aiavatar.repository;

import com.aistareco.aep.aiavatar.model.AiAvatarTemplate;
import com.aistareco.aep.aiavatar.model.AiAvatarTemplateCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AiAvatarTemplateRepository extends JpaRepository<AiAvatarTemplate, String> {

    List<AiAvatarTemplate> findByEnabledTrueOrderByCreatedAtDesc();

    List<AiAvatarTemplate> findByCategoryAndEnabledTrueOrderByCreatedAtDesc(AiAvatarTemplateCategory category);

    /** 用户可见模板：工厂模板（official=true）+ 自己的私有模板。 */
    @Query("SELECT t FROM AiAvatarTemplate t WHERE t.enabled = true AND (t.official = true OR t.ownerUserId = :userId) ORDER BY t.createdAt DESC")
    List<AiAvatarTemplate> findVisibleTo(@Param("userId") String userId);

    long countByOfficialTrue();
}
