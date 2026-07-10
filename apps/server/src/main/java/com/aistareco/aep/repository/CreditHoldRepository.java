package com.aistareco.aep.repository;

import com.aistareco.aep.model.CreditHold;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface CreditHoldRepository extends JpaRepository<CreditHold, String> {

    /**
     * 幂等查询：referenceType + referenceId 是 unique key。
     * 同一业务对象的 hold 唯一存在；ACTIVE / COMMITTED / RELEASED 三态下均能查到。
     */
    Optional<CreditHold> findByReferenceTypeAndReferenceId(String referenceType, String referenceId);

    /**
     * 悲观行锁版（同 WalletRepository#findByUserIdForUpdate 的模式）：commit / release 必须用这个而非
     * 上面的无锁版，否则同一 hold 的并发 commit+release（如 CreditHoldSweeper 与业务 commit 撞车）会各自
     * 读到同一份 status=ACTIVE 的旧对象，其中一次基于陈旧状态重复操作，造成双重退款 / 状态被覆盖。
     * 必须在 {@code @Transactional} 内调用；锁随事务提交/回滚释放。
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT h FROM CreditHold h WHERE h.referenceType = :referenceType AND h.referenceId = :referenceId")
    Optional<CreditHold> findByReferenceTypeAndReferenceIdForUpdate(@Param("referenceType") String referenceType,
                                                                     @Param("referenceId") String referenceId);

    /** 孤儿 hold 清扫：某状态下早于 cutoff 创建的 hold（sweeper 用，v2 §5 P0）。 */
    List<CreditHold> findByStatusAndCreatedAtBefore(CreditHold.Status status, Instant cutoff);
}
