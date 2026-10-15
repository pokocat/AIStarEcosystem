package com.aistareco.aep.enterprise.repository;
import com.aistareco.aep.enterprise.model.EnterpriseMember;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;
import jakarta.persistence.LockModeType;
import java.util.Optional;
public interface EnterpriseMemberRepository extends JpaRepository<EnterpriseMember,String> {
    Page<EnterpriseMember> findByEnterpriseIdOrderByJoinedAtAsc(String enterpriseId,Pageable pageable);
    Page<EnterpriseMember> findByEnterpriseIdAndStatusNotOrderByJoinedAtAsc(String enterpriseId,String status,Pageable pageable);
}
