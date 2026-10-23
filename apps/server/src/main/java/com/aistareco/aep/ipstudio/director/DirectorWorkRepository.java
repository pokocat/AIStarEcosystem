package com.aistareco.aep.ipstudio.director;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DirectorWorkRepository extends JpaRepository<DirectorWork, String> {
    List<DirectorWork> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from DirectorWork w where w.id = :id")
    Optional<DirectorWork> lockById(@Param("id") String id);

    @Query("select w.id from DirectorWork w where w.active = true and w.deletedAt is null")
    List<String> activeIds();
}
