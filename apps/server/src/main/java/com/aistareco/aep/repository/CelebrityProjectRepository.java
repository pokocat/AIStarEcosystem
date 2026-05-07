package com.aistareco.aep.repository;

import com.aistareco.aep.model.CelebrityProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CelebrityProjectRepository extends JpaRepository<CelebrityProject, String> {

    List<CelebrityProject> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);

    List<CelebrityProject> findByOwnerUserIdAndStatusOrderByCreatedAtDesc(String ownerUserId, String status);

    List<CelebrityProject> findByStarIdOrderByCreatedAtDesc(String starId);
}
