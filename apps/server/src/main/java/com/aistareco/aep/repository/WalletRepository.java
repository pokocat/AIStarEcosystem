package com.aistareco.aep.repository;

import com.aistareco.aep.model.Wallet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletRepository extends JpaRepository<Wallet, String>,
        PagingAndSortingRepository<Wallet, String> {

    Optional<Wallet> findByUserId(String userId);

    boolean existsByUserId(String userId);
}
