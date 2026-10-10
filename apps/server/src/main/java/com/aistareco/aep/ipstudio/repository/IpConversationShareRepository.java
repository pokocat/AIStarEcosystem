package com.aistareco.aep.ipstudio.repository;
import com.aistareco.aep.ipstudio.model.IpConversationShare;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface IpConversationShareRepository extends JpaRepository<IpConversationShare,String> {
    List<IpConversationShare> findByProjectIdAndNodeIdAndRevokedAtIsNullOrderByCreatedAtDesc(String projectId,String nodeId);
    @Lock(LockModeType.PESSIMISTIC_WRITE) @Query("select s from IpConversationShare s where s.token=:token")
    Optional<IpConversationShare> lock(@Param("token") String token);
}
