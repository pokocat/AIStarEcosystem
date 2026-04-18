package com.aistareco.aep.repository;

import com.aistareco.aep.model.SignedArtist;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SignedArtistRepository extends JpaRepository<SignedArtist, String> {
}
