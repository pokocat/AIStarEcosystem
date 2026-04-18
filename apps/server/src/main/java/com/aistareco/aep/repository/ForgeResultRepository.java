package com.aistareco.aep.repository;

import com.aistareco.aep.model.ForgeResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ForgeResultRepository extends JpaRepository<ForgeResult, String> {

    List<ForgeResult> findByArtistIdOrderByCreatedAtDesc(String artistId);
}
