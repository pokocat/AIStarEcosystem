package com.aistareco.aep.repository;

import com.aistareco.aep.model.MusicGenre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MusicGenreRepository extends JpaRepository<MusicGenre, String> {
}
