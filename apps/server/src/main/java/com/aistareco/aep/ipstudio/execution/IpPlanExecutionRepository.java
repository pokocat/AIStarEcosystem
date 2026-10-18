package com.aistareco.aep.ipstudio.execution;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** Lease and status changes are conditional updates; the caller learns from the row count whether it won. */
@Repository
public interface IpPlanExecutionRepository extends JpaRepository<IpPlanExecution,String> {
    Optional<IpPlanExecution> findByOwnerUserIdAndClientRequestId(String ownerUserId,String clientRequestId);
    List<IpPlanExecution> findByProjectIdAndStatusIn(String projectId,Collection<String> statuses);
    Optional<IpPlanExecution> findFirstByProjectIdAndOwnerUserIdOrderByCreatedAtDesc(String projectId,String ownerUserId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from IpPlanExecution e where e.id = :id")
    Optional<IpPlanExecution> lockById(@Param("id") String id);

    /** Executions that need a wake: running ones, and any state still tracking accepted native runs to settlement. */
    @Query("select e.id from IpPlanExecution e where e.status in :statuses and (e.leaseUntil is null or e.leaseUntil < :now) and (e.status = 'running' or e.inFlight > 0)")
    List<String> recoverable(@Param("statuses") Collection<String> statuses,@Param("now") Instant now);

    /** Take the lease only when it is free or expired (or already ours), and only from the version we read. */
    @Modifying(clearAutomatically=true,flushAutomatically=true) @Transactional
    @Query("update IpPlanExecution e set e.leaseOwner = :owner, e.leaseUntil = :until, e.leaseVersion = e.leaseVersion + 1 "
            + "where e.id = :id and e.leaseVersion = :version and (e.leaseUntil is null or e.leaseUntil < :now or e.leaseOwner = :owner)")
    int acquireLease(@Param("id") String id,@Param("owner") String owner,@Param("version") long version,@Param("now") Instant now,@Param("until") Instant until);

    @Modifying(clearAutomatically=true,flushAutomatically=true) @Transactional
    @Query("update IpPlanExecution e set e.leaseUntil = :until where e.id = :id and e.leaseOwner = :owner and e.leaseVersion = :version")
    int renewLease(@Param("id") String id,@Param("owner") String owner,@Param("version") long version,@Param("until") Instant until);

    @Modifying(clearAutomatically=true,flushAutomatically=true) @Transactional
    @Query("update IpPlanExecution e set e.leaseOwner = null, e.leaseUntil = null where e.id = :id and e.leaseOwner = :owner and e.leaseVersion = :version")
    int releaseLease(@Param("id") String id,@Param("owner") String owner,@Param("version") long version);

    /** Terminal / control transition from an expected set of states; bumps the lease version so a stale holder stops. */
    @Modifying(clearAutomatically=true,flushAutomatically=true) @Transactional
    @Query("update IpPlanExecution e set e.status = :to, e.updatedAt = :now, e.leaseVersion = e.leaseVersion + 1, e.leaseOwner = null, e.leaseUntil = null "
            + "where e.id = :id and e.status in :from")
    int transition(@Param("id") String id,@Param("from") Collection<String> from,@Param("to") String to,@Param("now") Instant now);
}
