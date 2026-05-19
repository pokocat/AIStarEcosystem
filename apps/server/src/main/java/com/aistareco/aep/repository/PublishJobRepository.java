package com.aistareco.aep.repository;

import com.aistareco.aep.model.PublishJob;
import com.aistareco.aep.model.PublishJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface PublishJobRepository extends JpaRepository<PublishJob, String> {

    List<PublishJob> findByUserIdOrderByCreatedAtDesc(String userId);

    List<PublishJob> findByUserIdAndProjectIdOrderByCreatedAtDesc(String userId, String projectId);

    List<PublishJob> findByUserIdAndStatusOrderByCreatedAtDesc(String userId, PublishJobStatus status);

    Optional<PublishJob> findByIdAndUserId(String id, String userId);

    Optional<PublishJob> findByExternalTaskId(String externalTaskId);

    List<PublishJob> findByStatusIn(Collection<PublishJobStatus> statuses);
}
