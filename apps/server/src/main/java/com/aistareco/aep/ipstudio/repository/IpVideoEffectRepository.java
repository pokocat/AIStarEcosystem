package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpVideoEffect;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface IpVideoEffectRepository extends JpaRepository<IpVideoEffect,String> {
    @Query("select e from IpVideoEffect e where e.visibility='official' or e.ownerUserId=:owner order by e.createdAt desc")
    List<IpVideoEffect> accessible(@Param("owner") String owner);
}
