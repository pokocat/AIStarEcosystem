package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarContract;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarContract 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarContractRepository extends JpaRepository<StarContract, String> {

    List<StarContract> findByStarIdOrderBySignDateDesc(String starId);
}
