package com.aistareco.aep.repository;

import com.aistareco.aep.model.CelebrityProjectVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CelebrityProjectVideoRepository extends JpaRepository<CelebrityProjectVideo, String> {

    List<CelebrityProjectVideo> findByProjectIdAndDeletedAtIsNullOrderByCreatedAtDesc(String projectId);

    List<CelebrityProjectVideo> findByStarIdAndDeletedAtIsNullOrderByCreatedAtDesc(String starId);

    List<CelebrityProjectVideo> findByStatusAndDeletedAtIsNullOrderByCreatedAtDesc(String status);

    List<CelebrityProjectVideo> findByDeletedAtIsNullOrderByCreatedAtDesc();
}
