package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpRun;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface IpRunRepository extends JpaRepository<IpRun, String> {
    /** 深度复刻受理前看动作提取排了多少段（StudioVideoTaskService#admitDepth）。 */
    long countByKindAndStatus(String kind, String status);
    @org.springframework.data.jpa.repository.Query("select r.id from IpRun r where r.kind = :kind and r.status = :status and r.startedAt is null order by r.createdAt, r.id")
    List<String> unstartedRunIds(@org.springframework.data.repository.query.Param("kind") String kind,
                                 @org.springframework.data.repository.query.Param("status") String status,
                                 org.springframework.data.domain.Pageable pageable);
    org.springframework.data.domain.Page<IpRun> findByOwnerUserIdAndKindOrderByCreatedAtDesc(String ownerUserId,String kind,org.springframework.data.domain.Pageable pageable);

    /** 账号「任务历史」：本人在时间窗内、指定几种 kind 的运行，新的在前（同一时刻按 id 再排，翻页不重不漏）。 */
    @org.springframework.data.jpa.repository.Query("select r from IpRun r where r.ownerUserId = :owner and r.createdAt >= :from and r.kind in :kinds and r.status in :statuses order by r.createdAt desc, r.id desc")
    List<IpRun> historyIn(@org.springframework.data.repository.query.Param("owner") String owner,
                          @org.springframework.data.repository.query.Param("from") Instant from,
                          @org.springframework.data.repository.query.Param("kinds") java.util.Collection<String> kinds,
                          @org.springframework.data.repository.query.Param("statuses") java.util.Collection<String> statuses,
                          org.springframework.data.domain.Pageable pageable);

    /** 同上，按 kind 前缀取、排除给定的几种（「全部」与「文字」两类用）。 */
    @org.springframework.data.jpa.repository.Query("select r from IpRun r where r.ownerUserId = :owner and r.createdAt >= :from and r.kind like :prefix and r.kind not in :excluded and r.status in :statuses order by r.createdAt desc, r.id desc")
    List<IpRun> historyLike(@org.springframework.data.repository.query.Param("owner") String owner,
                            @org.springframework.data.repository.query.Param("from") Instant from,
                            @org.springframework.data.repository.query.Param("prefix") String prefix,
                            @org.springframework.data.repository.query.Param("excluded") java.util.Collection<String> excluded,
                            @org.springframework.data.repository.query.Param("statuses") java.util.Collection<String> statuses,
                            org.springframework.data.domain.Pageable pageable);
    @org.springframework.data.jpa.repository.Query("select r from IpRun r where r.status in ('done','failed') and not exists (select x from IpLibraryRecord x where x.id=concat('ILC-',r.id)) order by r.createdAt")
    List<IpRun> uncollectedLibraryRuns(org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query("select x from IpRun x where x.projectId = ?1 and trim(trailing from x.clientRequestId) = trim(trailing from ?2)")
    Optional<IpRun> findByProjectIdAndClientRequestId(String projectId, String clientRequestId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select r from IpRun r where r.id = :id")
    Optional<IpRun> lockById(@org.springframework.data.repository.query.Param("id") String id);

    org.springframework.data.domain.Page<IpRun> findByProjectId(String projectId, org.springframework.data.domain.Pageable pageable);

    /** 项目全部运行，新的在前 —— 投影「每节点最近一次」时从头扫一遍即可。 */
    List<IpRun> findByProjectIdOrderByCreatedAtDesc(String projectId);

    List<IpRun> findByProjectIdAndNodeIdOrderByCreatedAtDesc(String projectId, String nodeId);

    /** 导演台删除前核对在途：只取 status / stage / nodeId / inputJson 四列，不进持久化上下文，读到的是数据库当前已提交值。 */
    @org.springframework.data.jpa.repository.Query("select r.status, r.stage, r.nodeId, r.inputJson from IpRun r where r.projectId = :projectId")
    List<Object[]> taskStates(@org.springframework.data.repository.query.Param("projectId") String projectId);

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
    /** A persisted accepted task is a durable pricing receipt, including already finished tasks. */
    @org.springframework.data.jpa.repository.Query("select r from IpRun r where r.kind='studio-audio' and r.inputJson like '%\"platformReleaseId\":\"%' and r.inputJson not like '%\"pricingReported\":true%' order by r.createdAt")
    org.springframework.data.domain.Page<IpRun> pendingPricingReceipts(org.springframework.data.domain.Pageable pageable);

}
