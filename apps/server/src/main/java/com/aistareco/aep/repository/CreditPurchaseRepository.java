package com.aistareco.aep.repository;

import com.aistareco.aep.model.CreditPurchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CreditPurchaseRepository extends JpaRepository<CreditPurchase, String> {
    List<CreditPurchase> findByUserIdOrderByCreatedAtDesc(String userId);
}
