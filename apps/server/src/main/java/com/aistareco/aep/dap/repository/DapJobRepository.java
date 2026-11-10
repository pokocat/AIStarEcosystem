package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface DapJobRepository extends JpaRepository<DapJob, String> {
    List<DapJob> findTop50ByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);
    List<DapJob> findByOwnerUserIdAndStatusOrderByCreatedAtDesc(String ownerUserId, String status);
    List<DapJob> findByOwnerUserIdAndAvatarIdOrderByCreatedAtDesc(String ownerUserId, String avatarId);
    Optional<DapJob> findByIdAndOwnerUserId(String id, String ownerUserId);
    long countByOwnerUserIdAndStatusAndFinishedAtAfter(String ownerUserId, String status, Instant after);
    @Query("SELECT COALESCE(SUM(j.cost),0) FROM DapJob j WHERE j.ownerUserId = :uid AND j.createdAt >= :since AND j.status <> 'failed'")
    long sumCostSince(@Param("uid") String uid, @Param("since") Instant since);
    List<DapJob> findByAvatarId(String avatarId);

    /** 账号「任务历史」：本人在时间窗内的数字人任务，新的在前。 */
    @Query("SELECT j FROM DapJob j WHERE j.ownerUserId = :uid AND j.createdAt >= :from AND j.status IN :statuses ORDER BY j.createdAt DESC, j.id DESC")
    List<DapJob> history(@Param("uid") String uid, @Param("from") Instant from,
                         @Param("statuses") java.util.Collection<String> statuses, org.springframework.data.domain.Pageable pageable);
}
