package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarRevenueMonth;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarRevenueMonth 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarRevenueMonthRepository extends JpaRepository<StarRevenueMonth, String> {

    List<StarRevenueMonth> findByStarIdOrderByMonthAsc(String starId);
}
