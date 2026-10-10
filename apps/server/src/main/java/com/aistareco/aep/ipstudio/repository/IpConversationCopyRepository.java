package com.aistareco.aep.ipstudio.repository;
import com.aistareco.aep.ipstudio.model.IpConversationCopy;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface IpConversationCopyRepository extends JpaRepository<IpConversationCopy,String> {
    Optional<IpConversationCopy> findByOwnerUserIdAndClientRequestId(String owner,String requestId);
}
