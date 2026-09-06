package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface IpRunRepository extends JpaRepository<IpRun, String> {

    /** 项目全部运行，新的在前 —— 投影「每节点最近一次」时从头扫一遍即可。 */
    List<IpRun> findByProjectIdOrderByCreatedAtDesc(String projectId);

    List<IpRun> findByProjectIdAndNodeIdOrderByCreatedAtDesc(String projectId, String nodeId);

    Optional<IpRun> findByIdAndOwnerUserId(String id, String ownerUserId);

    List<IpRun> findByStatusAndHeartbeatAtBefore(String status, Instant before);

    List<IpRun> findByProjectIdAndNodeIdAndStatus(String projectId, String nodeId, String status);
}
