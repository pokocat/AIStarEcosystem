package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarWhitelistRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarWhitelistRequest 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarWhitelistRequestRepository extends JpaRepository<StarWhitelistRequest, String> {

    List<StarWhitelistRequest> findByStarIdOrderByRequestedAtDesc(String starId);
}
