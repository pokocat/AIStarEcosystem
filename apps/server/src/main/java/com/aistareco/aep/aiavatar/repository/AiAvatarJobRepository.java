package com.aistareco.aep.aiavatar.repository;

import com.aistareco.aep.aiavatar.model.AiAvatarJob;
import com.aistareco.aep.aiavatar.model.AiAvatarJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface AiAvatarJobRepository extends JpaRepository<AiAvatarJob, String> {

    List<AiAvatarJob> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);

    Optional<AiAvatarJob> findByIdAndOwnerUserId(String id, String ownerUserId);

    List<AiAvatarJob> findByAvatarIdOrderByCreatedAtDesc(String avatarId);

    List<AiAvatarJob> findByStatus(AiAvatarJobStatus status);

    List<AiAvatarJob> findByStatusIn(List<AiAvatarJobStatus> statuses);

    List<AiAvatarJob> findByBatchIdOrderByCreatedAtAsc(String batchId);

    /** 监控线程：running 但心跳早于 cutoff（疑似异常中断的任务）。 */
    List<AiAvatarJob> findByStatusAndHeartbeatAtBefore(AiAvatarJobStatus status, OffsetDateTime cutoff);

    /** 监控线程：running 但心跳为 null 且创建时间早于 cutoff（进程重启丢失内存进度）。 */
    List<AiAvatarJob> findByStatusAndHeartbeatAtIsNullAndCreatedAtBefore(AiAvatarJobStatus status, OffsetDateTime cutoff);
}
