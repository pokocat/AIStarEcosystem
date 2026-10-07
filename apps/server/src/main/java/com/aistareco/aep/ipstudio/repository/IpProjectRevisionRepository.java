package com.aistareco.aep.ipstudio.repository;
import com.aistareco.aep.ipstudio.model.IpProjectRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface IpProjectRevisionRepository extends JpaRepository<IpProjectRevision,String> {
    List<IpProjectRevision> findByProjectIdOrderByCreatedAtDesc(String projectId);
    Optional<IpProjectRevision> findByIdAndProjectId(String id,String projectId);
}
