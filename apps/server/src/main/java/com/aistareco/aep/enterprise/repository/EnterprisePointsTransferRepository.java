package com.aistareco.aep.enterprise.repository;

import com.aistareco.aep.enterprise.model.EnterprisePointsTransfer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface EnterprisePointsTransferRepository extends JpaRepository<EnterprisePointsTransfer,String> {
    List<EnterprisePointsTransfer> findByBatchIdOrderByMemberIdAsc(String batchId);
    @Query("select t from EnterprisePointsTransfer t join EnterprisePointsBatch b on b.id=t.batchId where b.enterpriseId=:enterpriseId and (:memberId is null or t.memberId=:memberId) order by b.createdAt desc,t.id desc")
    Page<EnterprisePointsTransfer> listTransfers(@Param("enterpriseId") String enterpriseId,@Param("memberId") String memberId,Pageable pageable);
}
