package com.aistareco.aep.repository;

import com.aistareco.aep.model.StarDigitalHumanRequest;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;


/** StarDigitalHumanRequest 仓库（v0.60 web-star 明星商务工作台）。 */
public interface StarDigitalHumanRequestRepository extends JpaRepository<StarDigitalHumanRequest, String> {

    List<StarDigitalHumanRequest> findByStarIdOrderByRequestedAtDesc(String starId);
}
