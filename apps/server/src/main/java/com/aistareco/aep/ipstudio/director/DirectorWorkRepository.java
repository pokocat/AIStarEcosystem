package com.aistareco.aep.ipstudio.director;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DirectorWorkRepository extends JpaRepository<DirectorWork, String> {
    List<DirectorWork> findByOwnerUserIdAndDeletedAtIsNullOrderByUpdatedAtDesc(String ownerUserId);

    /** 回收站：本人已软删除的作品，最近删除的在前。 */
    List<DirectorWork> findByOwnerUserIdAndDeletedAtIsNotNullOrderByDeletedAtDesc(String ownerUserId);
    /** 到期清理：删除时间早于 cutoff 的作品。 */
    List<DirectorWork> findByDeletedAtBefore(java.time.Instant cutoff);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from DirectorWork w where w.id = :id")
    Optional<DirectorWork> lockById(@Param("id") String id);

    @Query("select w.id from DirectorWork w where w.active = true and w.deletedAt is null")
    List<String> activeIds();

    /** 改过、还没和资产库对账的作品（对账记录里存的是当时读到的作品更新时间）。 */
    @Query("select w.id, w.ownerUserId from DirectorWork w where w.deletedAt is null and not exists "
            + "(select x from com.aistareco.aep.ipstudio.model.IpLibraryRecord x where x.id = concat('ILW-', w.id) and x.updatedAt >= w.updatedAt) order by w.updatedAt")
    List<Object[]> needingLibrarySync(org.springframework.data.domain.Pageable pageable);

    /** 只取名字，不读作品正文。 */
    @Query("select w.id, w.title, w.deletedAt from DirectorWork w where w.ownerUserId = :owner")
    List<Object[]> namesOf(@Param("owner") String owner);
}
