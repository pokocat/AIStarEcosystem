package com.aistareco.aep.clip.repository;
import com.aistareco.aep.clip.model.ClipTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ClipTemplateRepository extends JpaRepository<ClipTemplate, String> {
    List<ClipTemplate> findByStatusAndDeletedAtIsNullOrderByUpdatedAtDesc(String status);
    List<ClipTemplate> findByDeletedAtIsNullOrderByUpdatedAtDesc();
}
