package com.aistareco.aep.repository;

import com.aistareco.aep.model.SavedOutfit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SavedOutfitRepository extends JpaRepository<SavedOutfit, String> {
    List<SavedOutfit> findByUserIdOrderByCreatedAtDesc(String userId);
}
