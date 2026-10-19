package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.EnterpriseCurrentMembership;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface EnterpriseCurrentMembershipRepository extends JpaRepository<EnterpriseCurrentMembership,String> {
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select m from EnterpriseCurrentMembership m where m.userId=:userId")
    Optional<EnterpriseCurrentMembership> findCurrentForUpdate(@Param("userId") String userId);

}
