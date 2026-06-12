package com.aistareco.aep.repository;

import com.aistareco.aep.model.DramaProject;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DramaProjectRepository extends JpaRepository<DramaProject, String> {

    List<DramaProject> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<DramaProject> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);
}
