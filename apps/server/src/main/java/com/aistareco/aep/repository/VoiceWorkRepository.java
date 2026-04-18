package com.aistareco.aep.repository;

import com.aistareco.aep.model.VoiceWork;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface VoiceWorkRepository extends JpaRepository<VoiceWork, String> {
}
