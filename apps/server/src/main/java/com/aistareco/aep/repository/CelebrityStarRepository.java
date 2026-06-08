package com.aistareco.aep.repository;

import com.aistareco.aep.model.CelebrityStar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CelebrityStarRepository extends JpaRepository<CelebrityStar, String> {
    List<CelebrityStar> findByCategory(String category);
    List<CelebrityStar> findByDeletedAtIsNull();
    List<CelebrityStar> findByCategoryAndDeletedAtIsNull(String category);
    Optional<CelebrityStar> findByIdAndDeletedAtIsNull(String id);
    long countByDeletedAtIsNull();
}
