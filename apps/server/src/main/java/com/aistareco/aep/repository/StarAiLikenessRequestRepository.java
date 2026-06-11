package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarAiLikenessRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarAiLikenessRequest 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarAiLikenessRequestRepository extends JpaRepository<StarAiLikenessRequest, String> {

    List<StarAiLikenessRequest> findByStarIdOrderByRequestedAtDesc(String starId);
}
