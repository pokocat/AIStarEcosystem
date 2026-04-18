package com.aistareco.aep.repository;

import com.aistareco.aep.model.CommunityPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CommunityPostRepository extends JpaRepository<CommunityPost, String> {
    Page<CommunityPost> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
