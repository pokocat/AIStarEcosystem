package com.aistareco.aep.ipstudio.skill;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface IpSkillVersionRepository extends JpaRepository<IpSkillVersion, String> {
    @Query("select v from IpSkillVersion v where trim(trailing from v.skillKey)=trim(trailing from ?1) and v.version=?2")
    Optional<IpSkillVersion> findBySkillKeyAndVersion(String skillKey, int version);
    @Query("select v from IpSkillVersion v where trim(trailing from v.skillKey)=trim(trailing from ?1) order by v.version desc")
    List<IpSkillVersion> findBySkillKeyOrderByVersionDesc(String skillKey);
    @Query("select v from IpSkillVersion v where trim(trailing from v.skillKey)=trim(trailing from ?1) and v.source=?2 order by v.version desc")
    List<IpSkillVersion> findBySkillKeyAndSourceOrderByVersionDesc(String skillKey, String source);

    @Query("select coalesce(max(v.version), 0) from IpSkillVersion v where trim(trailing from v.skillKey) = trim(trailing from :key)")
    int maxVersion(@Param("key") String key);

    @Query("select count(v) from IpSkillVersion v where trim(trailing from v.skillKey) = trim(trailing from :key) and v.status = 'published' and v.source <> 'seed'")
    long countPublishedNonSeed(@Param("key") String key);

    @Query("select count(v) from IpSkillVersion v where trim(trailing from v.skillKey) = trim(trailing from :key) and v.status = 'draft' and v.version > :current")
    long countPendingDrafts(@Param("key") String key, @Param("current") int current);
}
