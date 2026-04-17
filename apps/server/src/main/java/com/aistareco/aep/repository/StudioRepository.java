package com.aistareco.aep.repository;

import com.aistareco.aep.model.Studio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface StudioRepository extends JpaRepository<Studio, String>,
        PagingAndSortingRepository<Studio, String> {

    Optional<Studio> findByOwnerUserId(String ownerUserId);

    boolean existsByOwnerUserId(String ownerUserId);
}
