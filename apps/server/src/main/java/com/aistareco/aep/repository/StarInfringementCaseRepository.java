package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarInfringementCase;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarInfringementCase 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarInfringementCaseRepository extends JpaRepository<StarInfringementCase, String> {

    List<StarInfringementCase> findByStarIdOrderByReportedAtDesc(String starId);
}
