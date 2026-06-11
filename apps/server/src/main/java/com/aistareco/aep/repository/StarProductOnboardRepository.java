package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarProductOnboard;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarProductOnboard 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarProductOnboardRepository extends JpaRepository<StarProductOnboard, String> {

    List<StarProductOnboard> findByStarIdOrderBySubmittedAtDesc(String starId);
    List<StarProductOnboard> findByStarIdAndStepOrderByLibraryAtDesc(String starId, int step);
    List<StarProductOnboard> findBySubmittedByUserIdOrderBySubmittedAtDesc(String submittedByUserId);
    List<StarProductOnboard> findBySubmittedByUserIdAndProductId(String submittedByUserId, String productId);
    List<StarProductOnboard> findByProductIdAndStarId(String productId, String starId);
}
