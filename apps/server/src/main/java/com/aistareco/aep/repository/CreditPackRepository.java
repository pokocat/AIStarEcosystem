package com.aistareco.aep.repository;

import com.aistareco.aep.model.CreditPack;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CreditPackRepository extends JpaRepository<CreditPack, String> {
}
