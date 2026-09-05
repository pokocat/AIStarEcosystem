package com.aistareco.aep.repository;

import com.aistareco.aep.model.AepUser;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AepUserRepository extends JpaRepository<AepUser, String>,
        PagingAndSortingRepository<AepUser, String> {

    Optional<AepUser> findByUsername(String username);

    Optional<AepUser> findByEmail(String email);

    Optional<AepUser> findByPhone(String phone);

    /**
     * v0.149+（统一账号中心 §12.1）：按账号中心 uid 找本地档案。
     * 列上有唯一约束，JIT 建档的并发落败方靠这个方法回读赢家。
     */
    Optional<AepUser> findByIdentityUid(String identityUid);

    /**
     * v0.149+（§12.3 老用户导入）：还没有 uid 但有手机号的账号，按 id 游标升序取一批。
     * 用 id 游标而不是 offset 分页 —— 导入过程中会把命中的行写上 identity_uid，
     * offset 分页会漏行。
     */
    @Query("select u from AepUser u where u.identityUid is null "
            + "and u.phone is not null and u.phone <> '' and u.id > :afterId order by u.id asc")
    List<AepUser> findImportCandidates(@Param("afterId") String afterId, Pageable pageable);

    Page<AepUser> findByStatus(AepUser.UserStatus status, Pageable pageable);

    Page<AepUser> findByKind(AepUser.AccountKind kind, Pageable pageable);

    Page<AepUser> findByStatusAndKind(AepUser.UserStatus status, AepUser.AccountKind kind, Pageable pageable);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByPhone(String phone);

    long countByStatus(AepUser.UserStatus status);
}
