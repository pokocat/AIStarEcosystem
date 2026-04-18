package com.aistareco.aep.repository;

import com.aistareco.aep.model.Song;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SongRepository extends JpaRepository<Song, String> {
    List<Song> findByArtistIdOrderByCreatedAtDesc(String artistId);
}
