package com.aistareco.aep.repository;

import com.aistareco.aep.model.RechargeRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RechargeRecordRepository extends JpaRepository<RechargeRecord, String> {
}
