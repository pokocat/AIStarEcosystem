package com.aistareco.aep.repository;

import com.aistareco.aep.model.CelebrityStar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CelebrityStarRepository extends JpaRepository<CelebrityStar, String> {
    List<CelebrityStar> findByCategory(String category);
}
