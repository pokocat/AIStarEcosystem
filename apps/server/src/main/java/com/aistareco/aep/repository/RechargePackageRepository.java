package com.aistareco.aep.repository;

import com.aistareco.aep.model.RechargePackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RechargePackageRepository extends JpaRepository<RechargePackage, String> {

    /** 上架中的套餐，按 sortOrder 升序。 */
    List<RechargePackage> findByActiveTrueOrderBySortOrderAscCreditsAsc();
}
