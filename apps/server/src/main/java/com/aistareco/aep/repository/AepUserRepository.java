package com.aistareco.aep.repository;

import com.aistareco.aep.model.AepUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AepUserRepository extends JpaRepository<AepUser, String>,
        PagingAndSortingRepository<AepUser, String> {

    Optional<AepUser> findByUsername(String username);

    Optional<AepUser> findByEmail(String email);

    Page<AepUser> findByStatus(AepUser.UserStatus status, Pageable pageable);

    Page<AepUser> findByRole(AepUser.UserRole role, Pageable pageable);

    Page<AepUser> findByStatusAndRole(AepUser.UserStatus status, AepUser.UserRole role, Pageable pageable);

    long countByStatus(AepUser.UserStatus status);
}
