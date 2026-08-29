package com.aistareco.aep.repository;

import com.aistareco.aep.model.Song;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SongRepository extends JpaRepository<Song, String> {
    List<Song> findByArtistIdOrderByCreatedAtDesc(String artistId);

    /** 创作者直接归属的歌（无艺人创作路径；老数据 owner_user_id 为 null 不会命中）。 */
    List<Song> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);
}
