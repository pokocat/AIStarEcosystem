package com.aistareco.aep.repository;

import com.aistareco.aep.model.StorageGrant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;

public interface StorageGrantRepository extends JpaRepository<StorageGrant, String> {

    boolean existsBySource(String source);

    /** 某用户某子应用的有效扩容总量（MB），排除已过期。 */
    @Query("SELECT COALESCE(SUM(g.mb),0) FROM StorageGrant g WHERE g.app = :app AND g.ownerUserId = :uid "
            + "AND (g.expiresAt IS NULL OR g.expiresAt > :now)")
    long sumActiveMb(@Param("app") String app, @Param("uid") String uid, @Param("now") OffsetDateTime now);
}
