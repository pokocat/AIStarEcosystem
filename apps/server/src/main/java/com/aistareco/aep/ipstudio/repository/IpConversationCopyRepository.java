package com.aistareco.aep.ipstudio.repository;
import com.aistareco.aep.ipstudio.model.IpConversationCopy;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface IpConversationCopyRepository extends JpaRepository<IpConversationCopy,String> {
    @org.springframework.data.jpa.repository.Query("select x from IpConversationCopy x where x.ownerUserId = ?1 and trim(trailing from x.clientRequestId) = trim(trailing from ?2)")
    Optional<IpConversationCopy> findByOwnerUserIdAndClientRequestId(String owner,String requestId);
}
