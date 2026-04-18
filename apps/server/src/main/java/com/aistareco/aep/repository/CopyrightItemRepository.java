package com.aistareco.aep.repository;

import com.aistareco.aep.model.CopyrightItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CopyrightItemRepository extends JpaRepository<CopyrightItem, String> {

    List<CopyrightItem> findByStatus(CopyrightItem.CopyrightStatus status);

    List<CopyrightItem> findBySubmittedByUserIdOrderBySubmittedDateDesc(String userId);
}
