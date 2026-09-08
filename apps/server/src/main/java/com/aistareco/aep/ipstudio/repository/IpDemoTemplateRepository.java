package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpDemoTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IpDemoTemplateRepository extends JpaRepository<IpDemoTemplate, String> {

    /** 目录里要展示的示例：启用的，按排序。 */
    List<IpDemoTemplate> findByEnabledTrueOrderBySortOrderAscCreatedAtAsc();
}
