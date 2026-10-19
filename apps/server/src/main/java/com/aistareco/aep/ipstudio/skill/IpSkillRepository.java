package com.aistareco.aep.ipstudio.skill;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface IpSkillRepository extends JpaRepository<IpSkill, String> {
    List<IpSkill> findAllByOrderBySkillKeyAsc();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from IpSkill s where s.skillKey = :key")
    Optional<IpSkill> lockByKey(@Param("key") String key);

    /** Every skill row, locked in key order: status rules look at all skills (the last active one must stay active). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from IpSkill s order by s.skillKey asc")
    List<IpSkill> lockAll();
}
