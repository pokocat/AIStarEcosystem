package com.aistareco.aep.repository;

import com.aistareco.aep.model.MaterialViralHit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialViralHitRepository extends JpaRepository<MaterialViralHit, String> {
    List<MaterialViralHit> findAllByOrderByScoreDesc();
}
