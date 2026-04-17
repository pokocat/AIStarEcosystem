package com.aistareco.aep.repository;

import com.aistareco.aep.model.DigitalIp;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DigitalIpRepository extends JpaRepository<DigitalIp, String>,
        PagingAndSortingRepository<DigitalIp, String> {

    Page<DigitalIp> findByOwnerUserId(String ownerUserId, Pageable pageable);

    Page<DigitalIp> findByStudioId(String studioId, Pageable pageable);

    Page<DigitalIp> findByKind(DigitalIp.DigitalIpKind kind, Pageable pageable);

    List<DigitalIp> findByStudioId(String studioId);

    long countByStatus(DigitalIp.DigitalIpStatus status);
}
