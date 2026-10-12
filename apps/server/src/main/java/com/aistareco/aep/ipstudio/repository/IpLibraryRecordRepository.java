package com.aistareco.aep.ipstudio.repository;
import com.aistareco.aep.ipstudio.model.IpLibraryRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface IpLibraryRecordRepository extends JpaRepository<IpLibraryRecord,String> {
    List<IpLibraryRecord> findByOwnerUserIdAndRecordTypeAndDeletedAtIsNullOrderByCreatedAtDesc(String owner,String type);
    Optional<IpLibraryRecord> findByIdAndOwnerUserIdAndDeletedAtIsNull(String id,String owner);
}
