package com.aistareco.aep.repository;

import com.aistareco.aep.model.ForgeBlueprint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ForgeBlueprintRepository extends JpaRepository<ForgeBlueprint, String> {
    List<ForgeBlueprint> findByArtistIdOrderByCreatedAtDesc(String artistId);
}
