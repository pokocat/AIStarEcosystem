package com.aistareco.aep.ipstudio.repository;

import com.aistareco.aep.ipstudio.model.IpVideoEffectActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;

public interface IpVideoEffectActivityRepository extends JpaRepository<IpVideoEffectActivity,String> {
    List<IpVideoEffectActivity> findByOwnerUserId(String owner);
    Optional<IpVideoEffectActivity> findByOwnerUserIdAndEffectId(String owner,String effectId);
}
