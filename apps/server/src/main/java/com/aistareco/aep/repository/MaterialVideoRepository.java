package com.aistareco.aep.repository;

import com.aistareco.aep.model.MaterialVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MaterialVideoRepository extends JpaRepository<MaterialVideo, String> {
    List<MaterialVideo> findAllByOrderByOrdAsc();
    List<MaterialVideo> findByProductIdOrderByOrdAsc(String productId);
}
