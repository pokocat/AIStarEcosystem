package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpProject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IpProjectRepository extends JpaRepository<IpProject, String> {

    List<IpProject> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    /** 已发布且未删的项目 —— v0.181 视频资产回填用（发布之前跑出来的成片没被登记过）。 */
    List<IpProject> findByStatusAndDeletedAtIsNull(String status);

    Optional<IpProject> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);
}
