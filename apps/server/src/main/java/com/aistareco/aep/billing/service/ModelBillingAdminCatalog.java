package com.aistareco.aep.billing.service;

import com.aistareco.aep.billing.dto.ModelBillingDtos.*;
import com.aistareco.aep.billing.repository.ModelBillingWalletRepository;
import com.aistareco.aep.enterprise.repository.EnterpriseRepository;
import com.aistareco.aep.ipstudio.service.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.AepUserRepository;
import com.aistareco.aep.service.*;
import com.aistareco.common.BusinessException;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Configuration choices come from the same routes/specifications as accepted model requests. */
@Service
@Transactional(readOnly=true)
public class ModelBillingAdminCatalog {
    private final ModelBillingWalletRepository wallets;
    private final AepUserRepository users;
    private final EnterpriseRepository enterprises;
    private final com.aistareco.aep.repository.AiModelEndpointRepository endpoints;
    public ModelBillingAdminCatalog(ModelBillingWalletRepository wallets,AepUserRepository users,EnterpriseRepository enterprises,
            com.aistareco.aep.repository.AiModelEndpointRepository endpoints) {
        this.wallets=wallets;this.users=users;this.enterprises=enterprises;this.endpoints=endpoints;
    }
    public List<TargetOption> targets() {
        return endpoints.findAll().stream().filter(AiModelEndpoint::isEnabled)
                .sorted(Comparator.comparing(AiModelEndpoint::getId))
                .map(endpoint->{
                    var target=new ModelBillingTarget("endpoint","model",endpoint.getId(),ModelBillingTarget.providerModelOf(endpoint),"*","call");
                    return new TargetOption(endpoint.getId(),endpoint.publicModelName(),endpoint.getName(),target);
                }).toList();
    }
    public Page<WalletOption> wallets(String q,String type,Pageable page) {
        if(type!=null&&!Set.of("","personal","enterprise_member").contains(type))
            throw BusinessException.badRequest("SCOPED_ACCOUNT_TYPE_INVALID","请选择个人或企业成员账户");
        String query=query(q);var rows=wallets.search(type==null?"":type,pattern(query),query,page);
        var people=users.findAllById(rows.stream().map(w->w.getUserId()==null?w.getMemberUserId():w.getUserId()).distinct().toList())
                .stream().collect(Collectors.toMap(AepUser::getId,Function.identity()));
        var companies=enterprises.findAllById(rows.stream().map(Wallet::getEnterpriseId).filter(Objects::nonNull).distinct().toList())
                .stream().collect(Collectors.toMap(com.aistareco.aep.enterprise.model.Enterprise::getId,Function.identity()));
        return rows.map(w->{String uid=w.getUserId()==null?w.getMemberUserId():w.getUserId();var person=people.get(uid);var company=companies.get(w.getEnterpriseId());
            return new WalletOption(w.getId(),uid,person.getDisplayName()==null?person.getUsername():person.getDisplayName(),person.getPhone(),
                    w.getAccountType(),w.getEnterpriseId(),company==null?null:company.getName());});
    }
    public Page<EnterpriseOption> enterprises(String q,Pageable page) {
        String query=query(q);return enterprises.searchForBilling(pattern(query),query,page).map(e->new EnterpriseOption(e.getId(),e.getName(),e.getStatus()));
    }
    public Page<UserOption> users(String q,Pageable page) {
        return users.search(query(q).toLowerCase(Locale.ROOT),null,null,page)
                .map(u->new UserOption(u.getId(),u.getDisplayName()==null?u.getUsername():u.getDisplayName(),u.getPhone()));
    }
    private static String query(String value){String q=value==null?"":value.trim();if(q.length()>128)throw BusinessException.badRequest("QUERY_TOO_LONG","搜索内容最多 128 字");return q;}
    private static String pattern(String value){return "%"+value.toLowerCase(Locale.ROOT).replace("!","!!").replace("%","!%").replace("_","!_")+"%";}
}
