package com.aistareco.aep.repository;

import com.aistareco.aep.model.CelebrityProjectVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CelebrityProjectVideoRepository extends JpaRepository<CelebrityProjectVideo, String> {

    List<CelebrityProjectVideo> findByProjectIdOrderByCreatedAtDesc(String projectId);

    List<CelebrityProjectVideo> findByStarIdOrderByCreatedAtDesc(String starId);

    List<CelebrityProjectVideo> findByStatusOrderByCreatedAtDesc(String status);

    List<CelebrityProjectVideo> findAllByOrderByCreatedAtDesc();
}
