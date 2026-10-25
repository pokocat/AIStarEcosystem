package com.aistareco.aep.repository;

import com.aistareco.aep.model.AdminUser;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface AdminUserRepository extends JpaRepository<AdminUser, String> {

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select a from AdminUser a where a.id=:id")
    Optional<AdminUser> lockById(@org.springframework.data.repository.query.Param("id") String id);

    Optional<AdminUser> findByUsername(String username);

    Optional<AdminUser> findByEmail(String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    long countByRole(AdminUser.AdminRole role);

    long countByRoleAndStatus(AdminUser.AdminRole role, AdminUser.AdminStatus status);
}
