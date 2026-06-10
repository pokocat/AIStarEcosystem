package com.aistareco.aep.repository;

import com.aistareco.aep.model.DigitalIp;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DigitalIpRepository extends JpaRepository<DigitalIp, String>,
        PagingAndSortingRepository<DigitalIp, String> {

    Page<DigitalIp> findByOwnerUserId(String ownerUserId, Pageable pageable);

    List<DigitalIp> findByOwnerUserId(String ownerUserId);

    Page<DigitalIp> findByStudioId(String studioId, Pageable pageable);

    Page<DigitalIp> findByKind(DigitalIp.DigitalIpKind kind, Pageable pageable);

    List<DigitalIp> findByStudioId(String studioId);

    long countByStatus(DigitalIp.DigitalIpStatus status);

    Optional<DigitalIp> findFirstByOwnerUserIdAndDapAvatarIdAndKind(
            String ownerUserId, String dapAvatarId, DigitalIp.DigitalIpKind kind);

    /** v0.61 反向「应用于」：数字人被本人哪些艺人壳引用。 */
    List<DigitalIp> findByOwnerUserIdAndDapAvatarIdOrderByCreatedAtAsc(
            String ownerUserId, String dapAvatarId);
}
