package com.aistareco.aep.billing.repository;

import com.aistareco.aep.model.Wallet;
import org.springframework.data.repository.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.*;

public interface ModelBillingWalletRepository extends Repository<Wallet,String> {
    @Query("select w from Wallet w join AepUser u on u.id=coalesce(w.userId,w.memberUserId) "
            +"left join Enterprise e on e.id=w.enterpriseId "
            +"where w.accountType in ('personal','enterprise_member') and (:type='' or w.accountType=:type) "
            +"and (lower(u.displayName) like :pattern escape '!' or lower(u.username) like :pattern escape '!' "
            +"or u.phone like :pattern escape '!' or u.id=:exact or w.id=:exact or lower(e.name) like :pattern escape '!')")
    Page<Wallet> search(@Param("type") String type,@Param("pattern") String pattern,@Param("exact") String exact,Pageable page);
}
