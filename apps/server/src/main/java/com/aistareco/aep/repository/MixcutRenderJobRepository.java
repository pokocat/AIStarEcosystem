package com.aistareco.aep.repository;

import com.aistareco.aep.model.MixcutRenderJob;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MixcutRenderJobRepository extends JpaRepository<MixcutRenderJob, String> {
    List<MixcutRenderJob> findAllByOrderByCreatedAtDesc();
    List<MixcutRenderJob> findByUserIdOrderByCreatedAtDesc(String userId);
}
