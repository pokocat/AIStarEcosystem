package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IpProjectRepository extends JpaRepository<IpProject, String> {

    List<IpProject> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    Optional<IpProject> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);
}
