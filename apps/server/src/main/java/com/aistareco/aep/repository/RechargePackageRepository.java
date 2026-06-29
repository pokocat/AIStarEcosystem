package com.aistareco.aep.repository;

import com.aistareco.aep.model.RechargePackage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RechargePackageRepository extends JpaRepository<RechargePackage, String> {

    /** 上架中的套餐，按 sortOrder 升序。 */
    List<RechargePackage> findByActiveTrueOrderBySortOrderAscCreditsAsc();

    /**
     * 上架中、适用于指定子应用的套餐（v2 §6 按子应用配套餐）：通用（appScope null/all）+ 该子应用专属。
     */
    @Query("SELECT p FROM RechargePackage p WHERE p.active = true "
            + "AND (p.appScope IS NULL OR p.appScope = 'all' OR p.appScope = :sourceApp) "
            + "ORDER BY p.sortOrder ASC, p.credits ASC")
    List<RechargePackage> findActiveForApp(@Param("sourceApp") String sourceApp);
}
