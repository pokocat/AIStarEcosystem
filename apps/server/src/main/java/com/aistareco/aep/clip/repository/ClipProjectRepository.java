package com.aistareco.aep.clip.repository;
import com.aistareco.aep.clip.model.ClipProject;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.*;
import java.time.Instant;
public interface ClipProjectRepository extends JpaRepository<ClipProject, String> {
    Optional<ClipProject> findByIdAndExternalOwnerId(String id, String owner);
    Optional<ClipProject> findByIdAndExternalOwnerIdAndDeletedAtIsNull(String id, String owner);
    List<ClipProject> findByExternalOwnerIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String owner);
    List<ClipProject> findByExternalOwnerId(String owner);
    Optional<ClipProject> findFirstByExternalOwnerIdAndStatusAndDeletedAtIsNullOrderByUpdatedAtDesc(String owner, String status);
    List<ClipProject> findTop100ByDeletedAtBeforeOrderByDeletedAtAsc(Instant cutoff);

    /**
     * 加行级写锁读取（{@code SELECT ... FOR UPDATE}），供会对 {@code payloadJson} 做
     * 「读—改—写」的写入路径使用（{@code save} / {@code reset} / {@code recordShotArtifact}）。
     *
     * <p>为什么需要它：{@code payloadJson} 是整存整取的 JSON 文档，没有 {@code @Version}。
     * 用户在草稿态编辑（{@code save}，请求线程）与镜头 worker 把成片产物落回文档
     * （{@code recordShotArtifact}，{@code @Scheduled} worker 线程）会并发地各自读一份快照、
     * 改一处、整体写回 —— 后提交的一方覆盖先提交的一方，丢的是用户花钱换来的段级产物
     * （或用户刚做的文案编辑）。两条写路径都先经此方法取同一行的写锁，即串行化到该行上，
     * 关掉这个 lost-update 窗口。参照 {@code WalletRepository#findByUserIdForUpdate}。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM ClipProject p WHERE p.id = :id AND p.externalOwnerId = :owner AND p.deletedAt IS NULL")
    Optional<ClipProject> findByIdAndExternalOwnerIdAndDeletedAtIsNullForUpdate(@Param("id") String id, @Param("owner") String owner);
}
