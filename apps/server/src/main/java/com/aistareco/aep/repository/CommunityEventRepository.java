package com.aistareco.aep.repository;

import com.aistareco.aep.model.CommunityEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CommunityEventRepository extends JpaRepository<CommunityEvent, String> {
}
