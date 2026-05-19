package com.aistareco.aep.repository;

import com.aistareco.aep.model.PublishJobEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PublishJobEventRepository extends JpaRepository<PublishJobEvent, String> {

    List<PublishJobEvent> findByJobIdOrderByAtAsc(String jobId);
}
