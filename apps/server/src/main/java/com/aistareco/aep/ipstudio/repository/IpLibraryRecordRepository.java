package com.aistareco.aep.ipstudio.repository;
import com.aistareco.aep.ipstudio.model.IpLibraryRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface IpLibraryRecordRepository extends JpaRepository<IpLibraryRecord,String> {
    List<IpLibraryRecord> findByOwnerUserIdAndRecordTypeAndDeletedAtIsNullOrderByCreatedAtDesc(String owner,String type);
    Optional<IpLibraryRecord> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id,String owner);
    @org.springframework.data.jpa.repository.Query("select r.id from IpLibraryRecord r where r.id in :ids and r.ownerUserId=:owner and r.deletedAt is null")
    List<String> liveIds(@org.springframework.data.repository.query.Param("ids") Collection<String> ids,@org.springframework.data.repository.query.Param("owner") String owner);
}
