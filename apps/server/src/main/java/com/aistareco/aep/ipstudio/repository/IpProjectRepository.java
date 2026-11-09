package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpProject;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IpProjectRepository extends JpaRepository<IpProject, String> {

    /** 只取名字，不读画布文档。 */
    @Query("select p.id, p.name, p.deletedAt from IpProject p where p.ownerUserId = :owner")
    List<Object[]> namesOf(@Param("owner") String owner);

    /** 回收站：本人已删除的画布，最近删除的在前。只取名字和删除时间。 */
    @Query("select p.id, p.name, p.deletedAt from IpProject p where p.ownerUserId = :owner and p.deletedAt is not null order by p.deletedAt desc")
    List<Object[]> trashedOf(@Param("owner") String owner);

    /** 到期清理：删除时间早于 cutoff 的画布（id、owner）。 */
    @Query("select p.id, p.ownerUserId from IpProject p where p.deletedAt is not null and p.deletedAt < :cutoff")
    List<Object[]> trashedBefore(@Param("cutoff") java.time.Instant cutoff);

    List<IpProject> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);
    List<IpProject> findByOwnerUserIdAndTemplateVersionIdAndDeletedAtIsNull(String ownerUserId,String templateVersionId);

    /** 已发布且未删的项目 —— v0.181 视频资产回填用（发布之前跑出来的成片没被登记过）。 */
    List<IpProject> findByStatusAndDeletedAtIsNull(String status);

    Optional<IpProject> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id, String ownerUserId);

    /**
     * 发布专用：带行级悲观写锁（{@code SELECT ... FOR UPDATE}）加载项目。
     *
     * <p>发布是「读状态 → 建 DapAvatar/Look/衍生 → 回写 status」的长事务，中间不持锁时，
     * 用户双击「发布」或客户端重试会让两个并发事务都读到未发布状态、都把图发布成一份
     * 独立的 DapAvatar，产生一个谁都没引用的孤儿形象（文档记的 409 IP_PROJECT_ALREADY_PUBLISHED
     * 被绕过）。加锁后第二个事务阻塞到第一个提交，再读到 PUBLISHED，正确命中 409。
     * H2 / MySQL 均支持 FOR UPDATE。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from IpProject p where p.id = :id and p.ownerUserId = :ownerUserId and p.deletedAt is null")
    Optional<IpProject> findByIdAndOwnerUserIdAndDeletedAtIsNullForUpdate(@Param("id") String id,
                                                                         @Param("ownerUserId") String ownerUserId);
}
