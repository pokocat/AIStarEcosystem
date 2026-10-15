package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.Enterprise;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface EnterpriseRepository extends JpaRepository<Enterprise,String> {
    Optional<Enterprise> findByCreatedByAndCreateRequestId(String createdBy,String createRequestId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select e from Enterprise e where e.id=:id")
    Optional<Enterprise> lockById(@Param("id") String id);
}
