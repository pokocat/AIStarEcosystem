package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpTemplateVersion;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IpTemplateVersionRepository extends JpaRepository<IpTemplateVersion,String> {
    List<IpTemplateVersion> findByTemplateIdOrderByVersionDesc(String templateId);
}
