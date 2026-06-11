package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarContentRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarContentRule 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarContentRuleRepository extends JpaRepository<StarContentRule, String> {

    List<StarContentRule> findByStarIdOrderBySortOrderAsc(String starId);
}
