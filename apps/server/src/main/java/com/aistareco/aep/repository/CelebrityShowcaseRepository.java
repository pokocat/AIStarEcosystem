package com.aistareco.aep.repository;

import com.aistareco.aep.model.CelebrityShowcase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CelebrityShowcaseRepository extends JpaRepository<CelebrityShowcase, String> {
    List<CelebrityShowcase> findByMode(String mode);
}
