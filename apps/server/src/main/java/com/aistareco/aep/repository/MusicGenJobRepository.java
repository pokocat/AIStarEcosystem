package com.aistareco.aep.repository;

import com.aistareco.aep.model.MusicGenJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface MusicGenJobRepository extends JpaRepository<MusicGenJob, String> {

    List<MusicGenJob> findByOwnerUserIdOrderByCreatedAtDesc(String ownerUserId);

    /** 幂等查单：同一 owner 重复提交同一 clientRequestId 直接复用。 */
    Optional<MusicGenJob> findByOwnerUserIdAndClientRequestId(String ownerUserId, String clientRequestId);

    /**
     * reaper 用：捞出非终态且心跳过期的僵死任务。
     * 进程重启会让 @Async 线程消失，任务永远停在 generating —— 靠这个兜底判失败并退款。
     */
    List<MusicGenJob> findTop100ByStatusInAndHeartbeatAtBefore(List<String> statuses, OffsetDateTime before);
}
