package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarBrandAuthRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarBrandAuthRequest 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarBrandAuthRequestRepository extends JpaRepository<StarBrandAuthRequest, String> {

    List<StarBrandAuthRequest> findByStarIdOrderBySubmittedAtDesc(String starId);
}
