package com.aistareco.aep.repository;

import com.aistareco.aep.model.CelebrityAuthStatus;
import com.aistareco.aep.model.CelebrityStarAuthorization;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CelebrityStarAuthorizationRepository
        extends JpaRepository<CelebrityStarAuthorization, String> {

    /** 当前用户的"已授权 + 审核中"列表（用于 listStars?owner=me）。 */
    List<CelebrityStarAuthorization> findByUserIdAndStatusIn(
            String userId, Collection<CelebrityAuthStatus> statuses);

    /** 取单个用户对单颗明星的授权关系（详情页注入授权块）。 */
    Optional<CelebrityStarAuthorization> findByUserIdAndStarId(String userId, String starId);

    /** 该用户的全部授权（其他场景预留）。 */
    List<CelebrityStarAuthorization> findByUserId(String userId);
}
