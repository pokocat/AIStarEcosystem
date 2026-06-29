package com.aistareco.aep.repository;

import com.aistareco.aep.model.Wallet;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, String>,
        PagingAndSortingRepository<Wallet, String> {

    Optional<Wallet> findByUserId(String userId);

    /** 用于 hold 写路径：SELECT … FOR UPDATE 防并发超扣。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT w FROM Wallet w WHERE w.userId = :userId")
    Optional<Wallet> findByUserIdForUpdate(String userId);

    /** 用于 commitHold / releaseHold 写路径：按 wallet.id 加行锁。 */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT w FROM Wallet w WHERE w.id = :id")
    Optional<Wallet> findByIdForUpdate(String id);

    boolean existsByUserId(String userId);
}
