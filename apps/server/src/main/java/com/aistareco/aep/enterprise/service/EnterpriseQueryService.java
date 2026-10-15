package com.aistareco.aep.enterprise.service;

import com.aistareco.aep.enterprise.dto.*;
import com.aistareco.aep.enterprise.model.*;
import com.aistareco.aep.enterprise.repository.*;
import com.aistareco.aep.model.*;
import com.aistareco.aep.repository.*;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Enterprise payment reports never project prompts, personal payments, private assets or provider credentials. */
@Service @Transactional(readOnly=true)
public class EnterpriseQueryService {
    private final EnterpriseRepository enterprises;
    private final EnterpriseBillingAuthorizationRepository authorizations;
    private final EnterpriseAccessService access;
    private final AepUserRepository users;
    private final AiModelEndpointRepository endpoints;
    private final EntityManager em;
    public EnterpriseQueryService(EnterpriseRepository enterprises,EnterpriseBillingAuthorizationRepository authorizations,
            EnterpriseAccessService access,AepUserRepository users,AiModelEndpointRepository endpoints,EntityManager em) {
        this.enterprises=enterprises;this.authorizations=authorizations;this.access=access;this.users=users;this.endpoints=endpoints;this.em=em;
    }
    public Page<EnterpriseDtos.Enterprise> enterprises(String search,int page,int limit) {
        var pageable=page(page,limit);String needle=search==null?"":search.trim().toLowerCase(Locale.ROOT);
        String escaped=needle.replace("!","!!").replace("%","!%").replace("_","!_");
        var rows=em.createQuery("select e from Enterprise e where lower(e.name) like :search escape '!' or e.id=:id order by e.createdAt desc,e.id",Enterprise.class)
                .setParameter("search","%"+escaped+"%").setParameter("id",needle).setFirstResult(page*limit).setMaxResults(limit).getResultList();
        long count=em.createQuery("select count(e) from Enterprise e where lower(e.name) like :search escape '!' or e.id=:id",Long.class).setParameter("search","%"+escaped+"%").setParameter("id",needle).getSingleResult();
        return new PageImpl<>(rows.stream().map(e->new EnterpriseDtos.Enterprise(e.getId(),e.getName(),e.getOwnerUserId(),e.getStatus(),e.getVersion(),e.getCreatedAt(),e.getUpdatedAt())).toList(),pageable,count);
    }
    public Page<EnterpriseUsageDto> usage(String actor,String enterpriseId,int page,int limit) {
        var member=access.readMember(actor,enterpriseId);var enterprise=enterprises.findById(enterpriseId).orElseThrow();
        var permissions=access.permissions(enterprise,member);
        var rows=permissions.contains("usage.read")||permissions.contains("points.manage")
                ?authorizations.findByEnterpriseIdOrderByCreatedAtDesc(enterpriseId,page(page,limit))
                :authorizations.findByEnterpriseIdAndActorUserIdOrderByCreatedAtDesc(enterpriseId,actor,page(page,limit));
        return project(rows);
    }
    public Page<EnterpriseUsageDto> adminUsage(String enterpriseId,int page,int limit){return project(authorizations.findByEnterpriseIdOrderByCreatedAtDesc(enterpriseId,page(page,limit)));}
    private Page<EnterpriseUsageDto> project(Page<EnterpriseBillingAuthorization> rows) {
        var names=new HashMap<String,String>();users.findAllById(rows.stream().map(EnterpriseBillingAuthorization::getActorUserId).distinct().toList())
                .forEach(u->names.put(u.getId(),u.getDisplayName()==null||u.getDisplayName().isBlank()?u.getUsername():u.getDisplayName()));
        var models=new HashMap<String,String>();endpoints.findAllById(rows.stream().map(EnterpriseBillingAuthorization::getEndpointId).filter(Objects::nonNull).distinct().toList()).forEach(e->models.put(e.getId(),e.publicModelName()));
        List<String> ids=rows.stream().map(EnterpriseBillingAuthorization::getId).toList();var spent=new HashMap<String,Long>();
        if(!ids.isEmpty())for(var entry:em.createQuery("select e.billingAuthorizationId,sum(-e.amount) from LedgerEntry e where e.billingAuthorizationId in :ids and e.entryType=:type group by e.billingAuthorizationId",Object[].class)
                .setParameter("ids",ids).setParameter("type",LedgerEntry.LedgerEntryType.SPEND).getResultList())spent.put((String)entry[0],((Number)entry[1]).longValue());
        var pending=new HashMap<String,Long>();
        if(!ids.isEmpty())for(var entry:em.createQuery("select h.billingAuthorizationId,sum(h.remainingAmount) from CreditHold h where h.billingAuthorizationId in :ids and h.status=:status group by h.billingAuthorizationId",Object[].class)
                .setParameter("ids",ids).setParameter("status",CreditHold.Status.ACTIVE).getResultList())pending.put((String)entry[0],((Number)entry[1]).longValue());
        return rows.map(a->new EnterpriseUsageDto(a.getId(),a.getEnterpriseId(),a.getActorUserId(),names.getOrDefault(a.getActorUserId(),"企业成员"),a.getWalletId(),a.getReferenceType(),a.getReferenceId(),
                spent.getOrDefault(a.getId(),0L),pending.getOrDefault(a.getId(),0L),a.getStatus(),a.getEndpointId()==null?"本地处理":models.getOrDefault(a.getEndpointId(),"历史模型"),a.getCreatedAt()));
    }
    private static Pageable page(int page,int limit){if(page<0||limit<1||limit>100)throw com.aistareco.common.BusinessException.badRequest("ENTERPRISE_PAGE_INVALID","分页参数无效");return PageRequest.of(page,limit);}
}
