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

    @org.springframework.data.jpa.repository.Query("select x from AdminUser x where trim(trailing from x.username) = trim(trailing from :username)")
    Optional<AdminUser> findByUsername(@org.springframework.data.repository.query.Param("username") String username);

    @org.springframework.data.jpa.repository.Query("select x from AdminUser x where trim(trailing from x.email) = trim(trailing from :email)")
    Optional<AdminUser> findByEmail(@org.springframework.data.repository.query.Param("email") String email);

    @org.springframework.data.jpa.repository.Query("select count(x) > 0 from AdminUser x where trim(trailing from x.username) = trim(trailing from :username)")
    boolean existsByUsername(@org.springframework.data.repository.query.Param("username") String username);

    @org.springframework.data.jpa.repository.Query("select count(x) > 0 from AdminUser x where trim(trailing from x.email) = trim(trailing from :email)")
    boolean existsByEmail(@org.springframework.data.repository.query.Param("email") String email);

    long countByRole(AdminUser.AdminRole role);

    long countByRoleAndStatus(AdminUser.AdminRole role, AdminUser.AdminStatus status);
}
