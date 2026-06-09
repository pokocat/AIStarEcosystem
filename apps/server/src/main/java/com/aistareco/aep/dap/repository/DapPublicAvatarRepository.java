package com.aistareco.aep.dap.repository;

import com.aistareco.aep.dap.model.DapPublicAvatar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DapPublicAvatarRepository extends JpaRepository<DapPublicAvatar, String> {
    List<DapPublicAvatar> findAllByOrderBySortOrderAscCreatedAtDesc();
}
