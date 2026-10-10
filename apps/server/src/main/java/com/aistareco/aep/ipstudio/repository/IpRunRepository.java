package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface IpRunRepository extends JpaRepository<IpRun, String> {

    Optional<IpRun> findByProjectIdAndClientRequestId(String projectId, String clientRequestId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select r from IpRun r where r.id = :id")
    Optional<IpRun> lockById(@org.springframework.data.repository.query.Param("id") String id);

    org.springframework.data.domain.Page<IpRun> findByProjectId(String projectId, org.springframework.data.domain.Pageable pageable);

    /** 项目全部运行，新的在前 —— 投影「每节点最近一次」时从头扫一遍即可。 */
    List<IpRun> findByProjectIdOrderByCreatedAtDesc(String projectId);

    List<IpRun> findByProjectIdAndNodeIdOrderByCreatedAtDesc(String projectId, String nodeId);

    Optional<IpRun> findByIdAndOwnerUserId(String id, String ownerUserId);

    List<IpRun> findByStatusAndHeartbeatAtBefore(String status, Instant before);
    List<IpRun> findByKindAndStatus(String kind, String status);
    List<IpRun> findByStatus(String status);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically=true,flushAutomatically=true)
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("update IpRun r set r.pct=:pct, r.stage=:stage, r.heartbeatAt=:now, r.startedAt=coalesce(r.startedAt,:startedAt) where r.id=:id and r.status='running'")
    int updateProgressIfRunning(@org.springframework.data.repository.query.Param("id") String id,
            @org.springframework.data.repository.query.Param("pct") int pct,@org.springframework.data.repository.query.Param("stage") String stage,
            @org.springframework.data.repository.query.Param("now") Instant now,@org.springframework.data.repository.query.Param("startedAt") Instant startedAt);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically=true,flushAutomatically=true)
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("update IpRun r set r.startedAt=:now,r.heartbeatAt=:now where r.id=:id and r.status='running' and r.startedAt is null and r.cancelRequested=false")
    int claimUnstarted(@org.springframework.data.repository.query.Param("id") String id,@org.springframework.data.repository.query.Param("now") Instant now);

    List<IpRun> findByProjectIdAndNodeIdAndStatus(String projectId, String nodeId, String status);
}
