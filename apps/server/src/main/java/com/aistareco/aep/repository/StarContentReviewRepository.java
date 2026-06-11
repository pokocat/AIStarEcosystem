package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarContentReview;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarContentReview 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarContentReviewRepository extends JpaRepository<StarContentReview, String> {

    List<StarContentReview> findByStarIdOrderBySubmittedAtDesc(String starId);
}
